import {
    pool,
} from "../client.js";


import type {
    Priority,
    WishlistItem,
} from "../../types/wishlist.js";


interface DbItem {

    id: string;

    user_id: string;

    name: string;

    price: string | null;

    url: string | null;

    image_url: string | null;

    category: string;

    priority: number;

    bought: boolean;

    note: string | null;

    created_at: Date;

    updated_at: Date;
}


function mapItem(
    row: DbItem,
): WishlistItem {

    return {

        id:
            Number(row.id),

        name:
            row.name,

        price:
            row.price === null
                ? null
                : Number(row.price),

        url:
            row.url,

        imageUrl:
            row.image_url,

        category:
            row.category,

        priority:
            row.priority as Priority,

        bought:
            row.bought,

        note:
            row.note,

        createdAt:
            row.created_at.toISOString(),

        updatedAt:
            row.updated_at.toISOString(),
    };
}


export async function createItem(
    userId: number,
    data: {
        name: string;
        price?: number | null;
        url?: string | null;
        imageUrl?: string | null;
        category?: string;
        priority?: Priority;
        note?: string | null;
    },
): Promise<WishlistItem> {

    const result =
        await pool.query<DbItem>(
            `

            INSERT INTO wishlist_items (

                user_id,
                name,
                price,
                url,
                image_url,
                category,
                priority,
                bought,
                note
            )

            VALUES (

                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                FALSE,
                $8
            )

            RETURNING *

            `,
            [

                userId,

                data.name.trim(),

                data.price ??
                    null,

                data.url ??
                    null,

                data.imageUrl ??
                    null,

                data.category
                    ?.trim()
                    .toLowerCase() ??
                    "general",

                data.priority ??
                    1,

                data.note ??
                    null,
            ],
        );


    return mapItem(
        result.rows[0],
    );
}


export async function findItem(
    userId: number,
    itemId: number,
): Promise<WishlistItem | null> {

    const result =
        await pool.query<DbItem>(
            `

            SELECT *

            FROM wishlist_items

            WHERE user_id = $1

              AND id = $2

            `,
            [
                userId,
                itemId,
            ],
        );


    if (
        !result.rows[0]
    ) {

        return null;
    }


    return mapItem(
        result.rows[0],
    );
}


export async function listItems(
    userId: number,
): Promise<WishlistItem[]> {

    const result =
        await pool.query<DbItem>(
            `

            SELECT *

            FROM wishlist_items

            WHERE user_id = $1

            ORDER BY
                priority DESC,
                id ASC

            `,
            [
                userId,
            ],
        );


    return result.rows.map(
        mapItem,
    );
}


export async function deleteItem(
    userId: number,
    itemId: number,
): Promise<WishlistItem | null> {

    const result =
        await pool.query<DbItem>(
            `

            DELETE FROM wishlist_items

            WHERE user_id = $1

              AND id = $2

            RETURNING *

            `,
            [
                userId,
                itemId,
            ],
        );


    if (
        !result.rows[0]
    ) {

        return null;
    }


    return mapItem(
        result.rows[0],
    );
}


export async function updateItem(
    userId: number,
    itemId: number,
    changes: Partial<{

        name: string;

        price: number | null;

        url: string | null;

        imageUrl: string | null;

        category: string;

        priority: Priority;

        bought: boolean;

        note: string | null;

    }>,
): Promise<WishlistItem | null> {

    const item =
        await findItem(
            userId,
            itemId,
        );


    if (!item) {

        return null;
    }


    const updated = {

        name:
            changes.name ??
            item.name,

        price:
            changes.price !==
            undefined

                ? changes.price

                : item.price,

        url:
            changes.url !==
            undefined

                ? changes.url

                : item.url,

        imageUrl:
            changes.imageUrl !==
            undefined

                ? changes.imageUrl

                : item.imageUrl,

        category:
            changes.category ??
            item.category,

        priority:
            changes.priority ??
            item.priority,

        bought:
            changes.bought ??
            item.bought,

        note:
            changes.note !==
            undefined

                ? changes.note

                : item.note,
    };


    const result =
        await pool.query<DbItem>(
            `

            UPDATE wishlist_items

            SET

                name = $1,

                price = $2,

                url = $3,

                image_url = $4,

                category = $5,

                priority = $6,

                bought = $7,

                note = $8,

                updated_at = NOW()

            WHERE user_id = $9

              AND id = $10

            RETURNING *

            `,
            [

                updated.name,

                updated.price,

                updated.url,

                updated.imageUrl,

                updated.category,

                updated.priority,

                updated.bought,

                updated.note,

                userId,

                itemId,
            ],
        );


    return mapItem(
        result.rows[0],
    );
}


export async function searchItems(
    userId: number,
    term: string,
): Promise<WishlistItem[]> {

    const result =
        await pool.query<DbItem>(
            `

            SELECT *

            FROM wishlist_items

            WHERE user_id = $1

              AND (

                    name ILIKE $2

                    OR category ILIKE $2

                    OR note ILIKE $2

              )

            ORDER BY id ASC

            `,
            [

                userId,

                `%${term}%`,
            ],
        );


    return result.rows.map(
        mapItem,
    );
}


export async function restoreItem(
    userId: number,
    item: WishlistItem,
): Promise<WishlistItem> {

    const result =
        await pool.query<DbItem>(
            `

            INSERT INTO wishlist_items (

                id,
                user_id,
                name,
                price,
                url,
                image_url,
                category,
                priority,
                bought,
                note,
                created_at,
                updated_at
            )

            VALUES (

                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                NOW()
            )

            RETURNING *

            `,
            [

                item.id,

                userId,

                item.name,

                item.price,

                item.url,

                item.imageUrl,

                item.category,

                item.priority,

                item.bought,

                item.note,

                item.createdAt,
            ],
        );


    return mapItem(
        result.rows[0],
    );
}