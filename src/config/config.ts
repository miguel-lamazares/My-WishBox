export const config = {
    authDir:
        process.env.AUTH_DIR ??
        "auth_info",

    prefix:
        process.env.COMMAND_PREFIX ??
        "!",

    logLevel:
        process.env.LOG_LEVEL ??
        "info",

    databaseUrl:
        process.env.DATABASE_URL ??
        "postgresql://wishbox:noob@127.0.0.1:5432/wishbox",

    /*
     * O bot usa o próprio número do WhatsApp.
     *
     * Portanto mensagens fromMe são permitidas por padrão.
     *
     * Para bloquear:
     *
     * ALLOW_FROM_ME=0
     */
    allowFromMe:
        process.env.ALLOW_FROM_ME !== "0",

    allowedJids:
        (process.env.ALLOWED_JIDS ?? "")
            .split(",")
            .map(
                (jid) =>
                    jid.trim(),
            )
            .filter(Boolean),

    reconnect: {
        baseDelayMs:
            2_000,

        maxDelayMs:
            30_000,
    },

    messages: {
        maxSelfMessageAgeSeconds:
            15,

        processedCacheTtlMs:
            10 * 60 * 1000,
    },
} as const;