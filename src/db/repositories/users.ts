import {
    pool,
} from "../client.js";


export interface DbUser {

    id: number;

    jid: string;

    budget: number | null;

    createdAt: Date;

    updatedAt: Date;
}


function mapUser(
    row: any,
): DbUser {

    return {

        id:
            Number(row.id),

        jid:
            row.jid,

        budget:
            row.budget === null
                ? null
                : Number(row.budget),

        createdAt:
            row.created_at,

        updatedAt:
            row.updated_at,
    };
}


export async function getOrCreateUser(
    jid: string,
): Promise<DbUser> {

    const result =
        await pool.query(
            `

            INSERT INTO users (
                jid
            )

            VALUES ($1)

            ON CONFLICT (jid)

            DO UPDATE SET
                updated_at = NOW()

            RETURNING
                id,
                jid,
                budget,
                created_at,
                updated_at

            `,
            [
                jid,
            ],
        );


    return mapUser(
        result.rows[0],
    );
}


export async function getUser(
    jid: string,
): Promise<DbUser> {

    return getOrCreateUser(
        jid,
    );
}


export async function updateBudget(
    userId: number,
    budget: number | null,
): Promise<void> {

    await pool.query(
        `

        UPDATE users

        SET
            budget = $1,
            updated_at = NOW()

        WHERE id = $2

        `,
        [
            budget,
            userId,
        ],
    );
}