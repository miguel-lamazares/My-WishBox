import P from "pino";
import { config } from "../config/config.js";

export const logger = P({
    level: config.logLevel,
    transport:
        process.env.NODE_ENV === "production"
            ? undefined
            : { target: "pino-pretty", options: { colorize: true } },
});

// Logger silencioso para o Baileys (ele é muito verboso)
export const baileysLogger = P({ level: "silent" });
