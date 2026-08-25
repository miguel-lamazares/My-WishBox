import pg from "pg";

import {
    config,
} from "../config/config.js";


const {
    Pool,
} = pg;


export const pool =
    new Pool({

        connectionString:
            config.databaseUrl,

        max:
            10,

        idleTimeoutMillis:
            30_000,

        connectionTimeoutMillis:
            5_000,
    });


pool.on(
    "error",
    (
        error,
    ) => {

        console.error(
            "[DB] Unexpected PostgreSQL error:",
            error,
        );
    },
);


export async function closeDatabase(): Promise<void> {

    await pool.end();
}