import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    type WASocket,
} from "baileys";


import P from "pino";

import qrcode from "qrcode-terminal";


import {
    config,
} from "../config/config.js";


import {
    handleMessage,
} from "./handlers.js";


const baileysLogger =
    P({
        level:
            "silent",
    });


let activeSocket:
    WASocket | null =
    null;


let reconnectAttempts =
    0;


function getReconnectDelay(): number {

    const baseDelay =
        config.reconnect
            .baseDelayMs;


    const maxDelay =
        config.reconnect
            .maxDelayMs;


    return Math.min(

        baseDelay *
            Math.pow(
                2,
                reconnectAttempts,
            ),

        maxDelay,
    );
}


function isRelevantJid(
    jid: string,
): boolean {

    if (!jid) {

        return false;
    }


    if (
        jid ===
        "status@broadcast"
    ) {

        return false;
    }


    if (
        jid.endsWith(
            "@g.us",
        )
    ) {

        return false;
    }


    if (
        !jid.endsWith(
            "@s.whatsapp.net",
        ) &&
        !jid.endsWith(
            "@lid",
        )
    ) {

        return false;
    }


    return true;
}


export async function startWhatsApp(): Promise<WASocket> {

    const {
        state,
        saveCreds,
    } =
        await useMultiFileAuthState(
            config.authDir,
        );


    const socket =
        makeWASocket({

            auth:
                state,

            logger:
                baileysLogger,

            syncFullHistory:
                false,

            markOnlineOnConnect:
                false,

            generateHighQualityLinkPreview:
                false,
        });


    activeSocket =
        socket;


    socket.ev.on(
        "creds.update",
        saveCreds,
    );


    socket.ev.on(
        "messages.upsert",
        async (
            event,
        ) => {

            if (
                activeSocket !==
                socket
            ) {

                return;
            }


            for (
                const message
                of event.messages
            ) {

                const jid =
                    message
                        .key
                        .remoteJid;


                if (
                    !jid ||
                    !isRelevantJid(
                        jid,
                    )
                ) {

                    continue;
                }


                if (
                    !message.message
                ) {

                    continue;
                }


                try {

                    await handleMessage(
                        socket,
                        message,
                    );

                } catch (
                    error
                ) {

                    console.error(
                        "[ERROR] Message handler failed:",
                        error,
                    );
                }
            }
        },
    );


    socket.ev.on(
        "connection.update",
        (
            update,
        ) => {

            if (
                activeSocket !==
                socket
            ) {

                return;
            }


            const {
                connection,
                lastDisconnect,
                qr,
            } =
                update;


            if (qr) {

                console.log(
                    "\nScan the QR Code to connect WhatsApp.\n",
                );


                qrcode.generate(
                    qr,
                    {
                        small:
                            true,
                    },
                );
            }


            if (
                connection ===
                "open"
            ) {

                reconnectAttempts =
                    0;


                console.log(
                    "\nWhatsApp connected and listening for commands.\n",
                );


                return;
            }


            if (
                connection !==
                "close"
            ) {

                return;
            }


            const statusCode =
                (
                    lastDisconnect
                        ?.error as any
                )
                    ?.output
                    ?.statusCode;


            if (
                activeSocket ===
                socket
            ) {

                activeSocket =
                    null;
            }


            if (
                statusCode ===
                DisconnectReason.loggedOut
            ) {

                console.error(
                    `Logged out. Delete "${config.authDir}" and connect again.`,
                );

                return;
            }


            const delay =
                getReconnectDelay();


            reconnectAttempts +=
                1;


            console.log(
                `Connection closed. Reconnecting in ${delay / 1000}s...`,
            );


            setTimeout(
                () => {

                    startWhatsApp()
                        .catch(
                            (
                                error,
                            ) => {

                                console.error(
                                    "Reconnect failed:",
                                    error,
                                );
                            },
                        );

                },
                delay,
            );
        },
    );


    return socket;
}