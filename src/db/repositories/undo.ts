import {
    pool,
} from "../client.js";


import type {
    WishlistItem,
} from "../../types/wishlist.js";


export type UndoAction =

    | {
        type: "delete";
        item: WishlistItem;
    }

    | {
        type: "update";
        itemId: number;
        before: WishlistItem;
    }

    | {
        type: "create";
        item: WishlistItem;
    }

    | {
        type: "batch_delete";
        items: WishlistItem[];
    }

    | {
        type: "batch_update";
        items: Array<{
            itemId: number;
            before: WishlistItem;
        }>;
    };


export async function saveUndo(
    userId: number,
    action: UndoAction,
): Promise<void> {

    await pool.query(
        `

        INSERT INTO undo_snapshots (

            user_id,
            snapshot_data

        )

        VALUES (
            $1,
            $2::jsonb
        )

        `,
        [

            userId,

            JSON.stringify(
                action,
            ),
        ],
    );
}


export async function consumeUndo(
    userId: number,
): Promise<UndoAction | null> {

    const client =
        await pool.connect();


    try {

        await client.query(
            "BEGIN",
        );


        const result =
            await client.query(
                `

                SELECT
                    id,
                    snapshot_data

                FROM undo_snapshots

                WHERE user_id = $1

                ORDER BY
                    created_at DESC,
                    id DESC

                LIMIT 1

                FOR UPDATE

                `,
                [
                    userId,
                ],
            );


        if (
            result.rows.length === 0
        ) {

            await client.query(
                "COMMIT",
            );

            return null;
        }


        const row =
            result.rows[0];


        await client.query(
            `

            DELETE FROM undo_snapshots

            WHERE id = $1

            `,
            [
                row.id,
            ],
        );


        await client.query(
            "COMMIT",
        );


        return row.snapshot_data as UndoAction;

    } catch (
        error
    ) {

        await client.query(
            "ROLLBACK",
        );

        throw error;

    } finally {

        client.release();
    }
}