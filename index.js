/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
require("dotenv").config();
const fs = require("fs");

const Discord = require("discord.js");
const client = new Discord.Client({intents: new Discord.Intents(32767), partials: ["CHANNEL"]});

const selections = {};

const running = JSON.parse(fs.readFileSync("assets/running.json").toString());
running.running.forEach(([guildId, category]) => {
    if (!category) return;
    if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return;

    const categoryFile = JSON.parse(fs.readFileSync("assets/" + guildId + "/" + category + ".json").toString());
    if (!categoryFile.images || Object.entries(categoryFile.images).length === 0) return;
    if (!categoryFile.messages || Object.entries(categoryFile.messages).length === 0) return;

    const current = JSON.parse(fs.readFileSync("assets/" + guildId + "/.config.json").toString());
    if (!current.time || !current.channel || !current.rules) return;

    selections[guildId] = setInterval(async () => {
        const guild = await client.guilds.fetch(guildId).catch(() => { });
        if (!guild) return;

        const channel = await guild.channels.fetch(current.channel).catch(() => {});
        const target = await (await guild.members.fetch().catch(() => {})).filter((user) => {
            if (current.rules.excludeUser.includes(user.id)) return false;
            if (current.rules.bot !== undefined && user.user.bot !== current.rules.bot) return false;
            if (!user.roles.cache.some((role) => current.rules.includeRole.includes(role.id))) return false;
            if (user.roles.cache.some((role) => current.rules.excludeRole.includes(role.id))) return false;

            return true;
        }).random();

        if (!target) return;

        const messages = Object.entries(categoryFile.messages).map((entry) => entry[1]);
        const images = Object.entries(categoryFile.images).map((entry) => entry[1]);

        const sendMessage = {
            content: messages[Math.floor(Math.random() * messages.length)]
                .replace(/{UserID}/g, target.id)
                .replace(/{UserName}/g, target.user.username)
                .replace(/{UserTag}/g, target.user.tag),
            files: [
                {
                    attachment: images[Math.floor(Math.random() * images.length)],
                    name: category + ".png"
                }
            ]
        };

        channel.send(sendMessage).catch(() => {});
    }, current.time * 1000);
});

process.on("unhandledRejection", (error) => {
    console.log("unhandled rejection caught");
    console.log(error);
});
process.on("uncaughtException", (error) => {
    console.log("uncaught exception thrown");
    console.log(error);
});

(async () => {
    await client.login(process.env.TOKEN);

    client.on("messageCreate", async (message) => {
        if (message.author.bot || !message.content || !message.content.startsWith("<@989329190820130856>")) return;
        if (message.content === "<@989329190820130856> dontselectme") {
            try {
                const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/.config.json").toString());
                let added = true;
                if (!current.requestedExclude) current.requestedExclude = [message.author.id];
                else if (current.requestedExclude.includes(message.author.id)) {
                    current.requestedExclude = current.requestedExclude.filter((id) => id !== message.author.id);
                    added = false;
                } else {
                    current.requestedExclude.push(message.author.id);
                }

                fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(current, null, 4));

                message.reply(added ? "You'll no longer be selected." : "You opted in to be selected.").catch(() => { });
            } catch {
                const data = {
                    requestedExclude: []
                };

                data.requestedExclude.push(message.author.id);

                try {
                    fs.mkdirSync("assets/" + message.guildId);
                } catch {
                    console.log("oops");
                }
                fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(data, null, 4));

                message.reply("You'll no longer be selected.").catch(() => { });
            }
        }

        if (!message.member.permissions.has("MANAGE_GUILD")) return console.log("no permissions");

        if (message.content.split(" ").length > 1) {
            const command = message.content.split(" ")[1];

            if (command === "help") {
                help(message);
            } else if (command === "addimage") {
                console.log("adding image");
                const category = message.content.split(" ")[2];
                if (!category) return message.reply("Please specify a category to add the image to!").catch(() => { });
                if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                const image = message.attachments.first();
                if (!image) return message.reply("Attach an image to add!").catch(() => { });

                try {
                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/" + category + ".json").toString());
                    current.images[image.id] = image.url;

                    fs.writeFileSync("assets/" + message.guildId + "/" + category + ".json", JSON.stringify(current, null, 4));

                    message.reply("Successfully added the image to `" + category + "`").catch(() => { });
                } catch {
                    const data = {
                        images: {},
                        messages: {}
                    };

                    data.images[image.id] = image.url;
                    try {
                        fs.mkdirSync("assets/" + message.guildId);
                    } catch {
                        console.log("oops");
                    }
                    fs.writeFileSync("assets/" + message.guildId + "/" + category + ".json", JSON.stringify(data, null, 4));

                    message.reply("Successfully added the image to `" + category + "`. Remove it with `@Joji removeimage " + category + " " + image.id + "`").catch(() => { });
                }
            } else if (command === "addmessage") {
                console.log("adding message");
                const category = message.content.split(" ")[2];
                if (!category) return message.reply("Please specify a category to add the message to!");
                if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                if (message.content.split(" ").length < 4) return message.reply("Please add a message!");
                const messageContent = message.content.split(" ").slice(3).join(" ");

                try {
                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/" + category + ".json").toString());
                    current.messages[message.id] = messageContent;

                    fs.writeFileSync("assets/" + message.guildId + "/" + category + ".json", JSON.stringify(current, null, 4));

                    message.reply("Successfully added the message `" + messageContent + "` to `" + category + "`").catch(() => { });
                } catch {
                    const data = {
                        images: {},
                        messages: {}
                    };

                    data.messages[message.id] = messageContent;
                    try {
                        fs.mkdirSync("assets/" + message.guildId);
                    } catch {
                        console.log("oops");
                    }
                    fs.writeFileSync("assets/" + message.guildId + "/" + category + ".json", JSON.stringify(data, null, 4));

                    message.reply("Successfully added the message `" + messageContent + "` to `" + category + "`. Remove it with `@Joji removemessage " + category + " " + message.id + "`").catch(() => { });
                }
            } else if (command === "removeimage") {
                console.log("removing image");
                const category = message.content.split(" ")[2];
                if (!category) return message.reply("Please specify a category to remove the image from!").catch(() => { });
                if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                const target = message.content.split(" ")[3];
                if (!target) return message.reply("Specify a image ID to delete.").catch(() => { });

                try {
                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/" + category + ".json").toString());
                    if (!current.images[target]) return message.reply("That isn't a valid image.").catch(() => { });

                    delete current.images[target];

                    fs.writeFileSync("assets/" + message.guildId + "/" + category + ".json", JSON.stringify(current, null, 4));

                    message.reply("Removed the image from `" + category + "`").catch(() => { });
                } catch {
                    message.reply("You don't have any images in this category.").catch(() => { });
                }
            } else if (command === "removemessage") {
                console.log("removing message");
                const category = message.content.split(" ")[2];
                if (!category) return message.reply("Please specify a category to remove the message from!").catch(() => { });
                if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                const target = message.content.split(" ")[3];
                if (!target) return message.reply("Specify a message ID to delete.").catch(() => { });

                try {
                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/" + category + ".json").toString());
                    if (!current.messages[target]) return message.reply("That isn't a valid message.").catch(() => { });

                    delete current.messages[target];

                    fs.writeFileSync("assets/" + message.guildId + "/" + category + ".json", JSON.stringify(current, null, 4));

                    message.reply("Removed the message from `" + category + "`.").catch(() => { });
                } catch {
                    message.reply("You don't have any messages in this category.").catch(() => { });
                }
            } else if (command === "setchannel") {
                let target = message.content.split(" ")[2];
                if (!target) return message.reply("Specify a channel!").catch(() => { });

                if (/<#[0-9]{16,20}>/.test(target)) target = target.substring(2, target.length - 1);

                let channel = false;
                channel = await message.guild.channels.fetch(target).catch(() => {
                    channel = false;
                });

                if (!channel) return message.reply("That isn't a channel.");

                try {
                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/.config.json").toString());
                    current.channel = channel.id;

                    fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(current, null, 4));

                    message.reply("Messages will now be sent to <#" + channel.id + ">.").catch(() => { });
                } catch {
                    const data = {};

                    data.channel = channel.id;
                    try {
                        fs.mkdirSync("assets/" + message.guildId);
                    } catch {
                        console.log("oops");
                    }
                    fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(data, null, 4));

                    message.reply("Messages will now be sent to <#" + channel.id + ">. Don't forget to specify a time with `@Joji settime <time>`!").catch(() => { });
                }
            } else if (command === "settime") {
                let time = message.content.split(" ")[2];
                if (!time) return message.reply("Specify a time in the format 1h1m1s (1m1s, 1h, etc.)").catch(() => { });

                time = parseTime(time);
                console.log(time);

                if (time <= 0) return message.reply("Specify a time in the format 1h1m1s (1m1s, 1h, etc.)").catch(() => { });

                try {
                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/.config.json").toString());
                    current.time = time;

                    fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(current, null, 4));

                    message.reply("Messages will now be sent every " + parseTimeBack(time) + ".").catch(() => { });
                } catch {
                    const data = {};

                    data.time = time;
                    try {
                        fs.mkdirSync("assets/" + message.guildId);
                    } catch {
                        console.log("oops");
                    }
                    fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(data, null, 4));

                    message.reply("Messages will now be sent every " + parseTimeBack(time) + ". Don't forget to specify a channel with `@Joji setchannel <channel>`!").catch(() => { });
                }
            } else if (command === "selection") {
                // TODO selectionrules exclude
                if (message.content.split(" ").length < 3) {
                    message.reply(`**Selection rules help**
                !@Role - Users with this role will never be selected
                @Role - Users must have one of these roles to be selected
                !Bot - Bots will never be selected
                Bot - Only bots will be selected
                !@User - This specific user will never be selected`);
                } else {
                    const rules = message.content.split(" ").slice(2);
                    let ruleString = "";
                    const ruleObject = {
                        includeRole: [],
                        excludeRole: [],
                        excludeUser: []
                    };
                    rules.forEach((rule) => {
                        ruleString += "\n";
                        console.log(rule);
                        if (rule.startsWith("!<@&")) {
                            const role = rule.substring(4, rule.length - 1);
                            ruleString += "• Exclude role <@&" + role + ">";
                            ruleObject.excludeRole.push(role);
                        }

                        if (rule.startsWith("<@&")) {
                            const role = rule.substring(3, rule.length - 1);
                            ruleString += "• Require role <@&" + role + ">";
                            ruleObject.includeRole.push(role);
                        }

                        if (rule.toLowerCase() === "!bot") {
                            ruleString += "• Exclude bots";
                            ruleObject.bot = false;
                        }

                        if (rule.toLowerCase() === "bot") {
                            ruleString += "• Bots only";
                            ruleObject.bot = true;
                        }

                        if (rule.startsWith("!<@") && !rule.startsWith("!<@&")) {
                            const user = rule.substring(3, rule.length - 1);
                            ruleString += "• Exclude user <@" + user + ">";
                            ruleObject.excludeUser.push(user);
                        }
                    });

                    try {
                        const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/.config.json").toString());
                        current.rules = ruleObject;

                        fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(current, null, 4));

                        message.reply("Set your selection rules to: " + ruleString).catch(() => { });
                    } catch {
                        const data = {};

                        data.rules = ruleObject;
                        try {
                            fs.mkdirSync("assets/" + message.guildId);
                        } catch {
                            console.log("oops");
                        }
                        fs.writeFileSync("assets/" + message.guildId + "/.config.json", JSON.stringify(data, null, 4));

                        message.reply("Set your selection rules to: " + ruleString).catch(() => { });
                    }
                }
            } else if (command === "start") {
                try {
                    const category = message.content.split(" ")[2];
                    if (!category) return message.reply("Please specify a category!");
                    if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                    const categoryFile = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/" + category + ".json").toString());
                    if (!categoryFile.images || Object.entries(categoryFile.images).length === 0) return message.reply("Add some images to this category first!");
                    if (!categoryFile.messages || Object.entries(categoryFile.messages).length === 0) return message.reply("Add some messages to this category first!");

                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/.config.json").toString());
                    if (!current.time || !current.channel || !current.rules) return message.reply("Please specify a channel, time, and selection rules.");

                    selections[message.guild.id] = setInterval(async () => {
                        const channel = await message.guild.channels.fetch(current.channel).catch(() => {});
                        const target = await (await message.guild.members.fetch().catch(() => {})).filter((user) => {
                            if (current.rules.excludeUser.includes(user.id)) return false;
                            if (current.rules.bot !== undefined && user.user.bot !== current.rules.bot) return false;
                            if (!user.roles.cache.some((role) => current.rules.includeRole.includes(role.id))) return false;
                            if (user.roles.cache.some((role) => current.rules.excludeRole.includes(role.id))) return false;

                            return true;
                        }).random();

                        if (!target) return message.channel.send("Oops, something went wrong!").catch(() => {});

                        const messages = Object.entries(categoryFile.messages).map((entry) => entry[1]);
                        const images = Object.entries(categoryFile.images).map((entry) => entry[1]);

                        const sendMessage = {
                            content: messages[Math.floor(Math.random() * messages.length)]
                                .replace(/{UserID}/g, target.id)
                                .replace(/{UserName}/g, target.user.username)
                                .replace(/{UserTag}/g, target.user.tag),
                            files: [
                                {
                                    attachment: images[Math.floor(Math.random() * images.length)],
                                    name: category + ".png"
                                }
                            ]
                        };

                        channel.send(sendMessage).catch(() => {});
                    }, current.time * 1000);

                    const running = JSON.parse(fs.readFileSync("assets/running.json").toString());
                    running.running.push([message.guild.id, category]);
                    fs.writeFileSync("assets/running.json", JSON.stringify(running, null, 4));

                    message.reply("Now beginning to send messages.").catch(() => { });
                } catch (error) {
                    console.log(error);
                    message.reply("Specify a time and channel, and make sure that this category exists!").catch(() => { });
                }
            } else if (command === "stop") {
                if (selections[message.guild.id]) {
                    clearInterval(selections[message.guild.id]);
                    delete selections[message.guild.id];

                    const running = JSON.parse(fs.readFileSync("assets/running.json").toString());
                    running.running = running.running.filter(([guildId]) => guildId !== message.guild.id);
                    fs.writeFileSync("assets/running.json", JSON.stringify(running, null, 4));
                    message.reply("Stopped.");
                } else {
                    message.reply("Not started!");
                }
            } else if (command === "select") {
                try {
                    const category = message.content.split(" ")[2];
                    if (!category) return message.reply("Please specify a category!");
                    if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                    const categoryFile = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/" + category + ".json").toString());
                    if (!categoryFile.images || Object.entries(categoryFile.images).length === 0) return message.reply("Add some images to this category first!");
                    if (!categoryFile.messages || Object.entries(categoryFile.messages).length === 0) return message.reply("Add some messages to this category first!");

                    const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/.config.json").toString());
                    if (!current.time || !current.channel || !current.rules) return message.reply("Please specify a channel, time, and selection rules.");

                    const channel = await message.guild.channels.fetch(current.channel).catch(() => {});
                    const target = await (await message.guild.members.fetch().catch(() => {})).filter((user) => {
                        if (current.rules.excludeUser.includes(user.id)) return false;
                        if (current.rules.bot !== undefined && user.user.bot !== current.rules.bot) return false;
                        if (!user.roles.cache.some((role) => current.rules.includeRole.includes(role.id))) return false;
                        if (user.roles.cache.some((role) => current.rules.excludeRole.includes(role.id))) return false;

                        return true;
                    }).random();

                    if (!target) return message.channel.send("Oops, something went wrong!").catch(() => {});

                    const messages = Object.entries(categoryFile.messages).map((entry) => entry[1]);
                    const images = Object.entries(categoryFile.images).map((entry) => entry[1]);

                    const sendMessage = {
                        content: messages[Math.floor(Math.random() * messages.length)]
                            .replace(/{UserID}/g, target.id)
                            .replace(/{UserName}/g, target.user.username)
                            .replace(/{UserTag}/g, target.user.tag),
                        files: [
                            {
                                attachment: images[Math.floor(Math.random() * images.length)],
                                name: category + ".png"
                            }
                        ]
                    };

                    channel.send(sendMessage).catch(() => {});

                    const running = JSON.parse(fs.readFileSync("assets/running.json").toString());
                    running.running.push([message.guild.id, category]);
                    fs.writeFileSync("assets/running.json", JSON.stringify(running, null, 4));

                    message.reply("Selected a random user!").catch(() => { });
                } catch (error) {
                    console.log(error);
                    message.reply("Specify a time and channel, and make sure that this category exists!").catch(() => { });
                }
            } else if (command === "list") {
                const category = message.content.split(" ")[2];
                if (category) {
                    if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                    try {
                        const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/" + category + ".json").toString());
                        let messageContent = "Information about: " + category + "\n\n**Images**\n";

                        Object.entries(current.images).forEach(([id, url]) => {
                            messageContent += "**ID: **" + id + " **URL: **" + url + "\n";
                        });

                        messageContent += "\n**Messages**\n";

                        Object.entries(current.messages).forEach(([id, content]) => {
                            messageContent += "**ID: **" + id + " **Content: **" + content + "\n";
                        });

                        message.reply(messageContent).catch(() => { }).then((message) => {
                            message.suppressEmbeds();
                        });
                    } catch {
                        message.reply("That category doesn't exist.").catch(() => {});
                    }
                } else {
                    try {
                        const current = JSON.parse(fs.readFileSync("assets/" + message.guildId + "/.config.json").toString());

                        const categories = fs.readdirSync("assets/" + message.guild.id).filter((fileName) => !fileName.startsWith(".")).map((value) => {
                            return " • " + value.substring(0, value.length - 5);
                        });

                        let ruleString = "";

                        if (current.rules) {
                            current.rules.excludeRole.forEach((role) => {
                                ruleString += " • Exclude role <@&" + role + ">\n";
                            });

                            current.rules.includeRole.forEach((role) => {
                                ruleString += " • Include role <@&" + role + ">\n";
                            });

                            current.rules.excludeUser.forEach((user) => {
                                ruleString += " • Exclude user <@" + user + ">\n";
                            });

                            if (current.rules.bot !== undefined) {
                                if (current.rules.bot === true) {
                                    ruleString += " • Bots only\n";
                                } else {
                                    ruleString += " • No bots\n";
                                }
                            }
                        }

                        const messageContent = `**Configuration for ${message.guild.name}**
**Interval:** ${parseTimeBack(current.time || "*No interval set.*")}
**Channel:** ${current.channel ? `<#${current.channel}>` : "*No channel set.*"}
**Categories**
${categories.join("\n")}
**Rules**
${ruleString}`;

                        message.reply(messageContent).catch(() => {});
                    } catch {
                        message.reply("You haven't set up your server yet. Get started with `@Joji help`.").catch(() => {});
                    }
                }
            } else if (command === "delete") {
                const category = message.content.split(" ")[2];
                if (!category) return message.reply("Please specify a category to delete.").catch(() => { });
                if (/[^a-zA-Z0-9-_]/.test(category) || category.length > 64) return message.reply("Category names can only contain letters, numbers, -, and _, and can only be up to 64 characters long.").catch(() => { });

                try {
                    fs.rmSync("assets/" + message.guild.id + "/" + category + ".json");
                    message.reply("Removed category `" + category + "`.").catch(() => { });
                } catch {
                    message.reply("Something went wrong. Most likely, that category doesn't exist.").catch(() => { });
                }
            }
        } else {
            help(message);
        }
    });
})();

function parseTime(time) {
    const units = {s: 1, m: 60, h: 3600};
    return time.toLowerCase().match(/\d+./g).reduce((acc, p) => acc + parseInt(p) * units[p.at(-1)], 0);
}

function parseTimeBack(timeInt) {
    let string = "";
    if (timeInt >= 3600) string += Math.floor(timeInt / 3600) + ` hour${Math.floor(timeInt / 3600) === 1 ? "" : "s"} `;
    timeInt = timeInt % 3600;

    if (timeInt >= 60) string += Math.floor(timeInt / 60) + ` minute${Math.floor(timeInt / 60) === 1 ? "" : "s"} `;
    timeInt = timeInt % 60;

    if (timeInt > 0) string += Math.floor(timeInt) + ` second${Math.floor(timeInt) === 1 ? "" : "s"} `;
    return string;
}

function help(message) {
    message.reply(`**Joji Help**
**Only people with the "Manage server" permission can use these commands**
<@989329190820130856> help - Displays this help message
<@989329190820130856> addimage <category> - Adds the image to the random selection (<@989329190820130856> addimage category1)
<@989329190820130856> removeimage <category> <id> - Removes an image from the random selection (<@989329190820130856> removeimage category1 12345678912345679)
<@989329190820130856> addmessage <category> - Adds a message to the random selection - you can use {UserID}, {UserName}, and {UserTag} (<@989329190820130856> addmessage category1 Hello, <@{UserId}>!)
<@989329190820130856> removemessage <category> <id> - Removes a message from the random selection (<@989329190820130856> removemessage category1 12345678912345679)
<@989329190820130856> setchannel <channel> - Sets the channel to send messages to (<@989329190820130856> setchannel #main-chat)
<@989329190820130856> settime <time> - Set how often to pick a user (<@989329190820130856> settime 1h30m)
<@989329190820130856> selection <rules...> - Sets filters to pick users from (<@989329190820130856> selectionrules @Role1 @Role2 !@Role3 NotBot)
<@989329190820130856> start <category> - Start randomly selecting users with images from the category (<@989329190820130856> start category1)
<@989329190820130856> stop - Stop randomly selecting users (<@989329190820130856> stop)
<@989329190820130856> select <category> - Randomly select a user now (<@989329190820130856> select category1)
<@989329190820130856> list [category] - List messages and images in the category, or list categories (<@989329190820130856> list category1)
<@989329190820130856> delete <category> - Deletes the specified category (<@989329190820130856> delete category1)
**Anyone can use this command**
<@989329190820130856> dontselectme - Toggles whether Joji can select you
`).catch(() => { });
}

