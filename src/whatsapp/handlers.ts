import type {
    WASocket,
    WAMessage,
} from "baileys";


import {
    resolve,
} from "../commands/router.js";


import {
    continuePending,
} from "../commands/commands.js";


import {
    config,
} from "../config/config.js";


import {
    downloadImage,
} from "../util/image.js";


const sentMessageIds =
    new Set<string>();


const sentMessagesByJid =
    new Map<
        string,
        WAMessage[]
    >();


function rememberSentMessage(
    jid: string,
    message: WAMessage,
): void {

    const id =
        message.key.id;


    if (!id) {

        return;
    }


    sentMessageIds.add(
        id,
    );


    const messages =
        sentMessagesByJid.get(
            jid,
        ) ?? [];


    messages.push(
        message,
    );


    sentMessagesByJid.set(
        jid,
        messages,
    );


    setTimeout(
        () => {

            sentMessageIds.delete(
                id,
            );

        },
        60_000,
    );
}


export function getSentMessages(
    jid: string,
): WAMessage[] {

    return [
        ...(
            sentMessagesByJid.get(
                jid,
            ) ?? []
        ),
    ];
}


export function forgetSentMessage(
    jid: string,
    messageId?: string,
): void {

    if (!messageId) {

        return;
    }


    const messages =
        sentMessagesByJid.get(
            jid,
        );


    if (!messages) {

        return;
    }


    const filtered =
        messages.filter(
            (
                message,
            ) =>
                message.key.id !==
                messageId,
        );


    if (
        filtered.length === 0
    ) {

        sentMessagesByJid.delete(
            jid,
        );

        return;
    }


    sentMessagesByJid.set(
        jid,
        filtered,
    );
}


export function clearSentMessages(
    jid: string,
): void {

    sentMessagesByJid.delete(
        jid,
    );
}


function extractText(
    message: WAMessage,
): string | null {

    const content =
        message.message;


    if (!content) {

        return null;
    }


    if (
        content.conversation
    ) {

        return content.conversation;
    }


    if (
        content.extendedTextMessage?.text
    ) {

        return (
            content
                .extendedTextMessage
                .text
        );
    }


    return null;
}


function isAllowed(
    jid: string,
): boolean {

    if (
        config.allowedJids.length === 0
    ) {

        return true;
    }


    return config.allowedJids.includes(
        jid,
    );
}


export async function handleMessage(
    socket: WASocket,
    message: WAMessage,
): Promise<void> {

    const jid =
        message.key.remoteJid;


    if (!jid) {

        return;
    }


    /*
     * Groups
     */

    if (
        jid.endsWith("@g.us")
    ) {

        return;
    }


    /*
     * Status
     */

    if (
        jid ===
        "status@broadcast"
    ) {

        return;
    }


    /*
     * Ignore messages sent by the bot itself.
     *
     * This only catches messages that were
     * explicitly registered by reply().
     */

    const messageId =
    message.key.id;

if (
    message.key.fromMe &&
    messageId &&
    sentMessageIds.has(
        messageId,
    )
) {
    
    return;
}


    /*
     * Whitelist
     */

    if (
        !isAllowed(jid)
    ) {

        console.log(
            `[IGNORED] Unauthorized JID: ${jid}`,
        );

        return;
    }


    /*
     * If this is fromMe, allow it only
     * when configured.
     */

    if (
        message.key.fromMe &&
        !config.allowFromMe
    ) {

        return;
    }


    const text =
        extractText(
            message,
        );


    if (!text) {

        return;
    }


    console.log(
        `[MESSAGE] ${jid} | fromMe=${message.key.fromMe} | ${JSON.stringify(text)}`,
    );


    const reply = async (
        responseText: string,
        options?: {
            imageUrl?: string | null;
        },
    ): Promise<void> => {

        /*
         * Image response
         */

        if (
            options?.imageUrl
        ) {

            try {

                const imageBuffer =
                    await downloadImage(
                        options.imageUrl,
                    );


                const sent =
                    await socket.sendMessage(
                        jid,
                        {

                            image:
                                imageBuffer,

                            caption:
                                responseText,
                        },
                    );


                if (sent) {

                    rememberSentMessage(
                        jid,
                        sent,
                    );
                }


                return;

            } catch (
                error
            ) {

                console.error(
                    `[IMAGE ERROR] ${jid}:`,
                    error,
                );


                const sent =
                    await socket.sendMessage(
                        jid,
                        {

                            text:
                                [
                                    responseText,
                                    "",
                                    "⚠️ Image could not be loaded.",
                                    `🖼️ ${options.imageUrl}`,
                                ].join("\n"),
                        },
                    );


                if (sent) {

                    rememberSentMessage(
                        jid,
                        sent,
                    );
                }


                return;
            }
        }


        /*
         * Normal response
         */

        const sent =
            await socket.sendMessage(
                jid,
                {

                    text:
                        responseText,
                },
            );


        if (sent) {

            rememberSentMessage(
                jid,
                sent,
            );
        }
    };


    /*
     * Guided flow
     */

    if (
        !text.startsWith(
            config.prefix,
        )
    ) {

        const handled =
            await continuePending(
                {

                    socket,

                    message,

                    jid,

                    args: [],

                    rest: text,

                    reply,
                },

                text,
            );


        if (handled) {

            return;
        }


        return;
    }


    /*
     * Command
     */

    const commandLine =
        text
            .slice(
                config.prefix.length,
            )
            .trim();


    if (!commandLine) {

        return;
    }


    const parts =
        commandLine.split(
            /\s+/,
        );


    const commandName =
        parts[0]
            ?.toLowerCase();


    if (!commandName) {

        return;
    }


    const args =
        parts.slice(1);


    const rest =
        args.join(" ");


    const command =
        resolve(
            commandName,
        );


    if (!command) {

        await reply(
            `❌ Unknown command: ${config.prefix}${commandName}\n\nUse ${config.prefix}help.`,
        );

        return;
    }


    try {

        await command.handler({

            socket,

            message,

            jid,

            args,

            rest,

            reply,
        });

    } catch (
        error
    ) {

        console.error(
            `[ERROR] ${commandName}:`,
            error,
        );


        await reply(
            "❌ Error processing command.",
        );
    }
}