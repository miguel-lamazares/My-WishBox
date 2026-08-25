import {
    config,
} from "../config/config.js";


import {
    saveUndo,
    consumeUndo,
} from "../db/repositories/undo.js";


import type {
    Priority,
    WishlistItem,
} from "../types/wishlist.js";


import {
    list,
    register,
    type CommandContext,
} from "./router.js";


import {
    getOrCreateUser,
    updateBudget,
} from "../db/repositories/users.js";


import {
    createItem,
    deleteItem,
    findItem,
    listItems,
    searchItems,
    updateItem,
    restoreItem,
} from "../db/repositories/wishlist.js";


import {
    formatItem,
    formatMoney,
    priorityLabel,
} from "../utils.js";


import {
    clearSentMessages,
    forgetSentMessage,
    getSentMessages,
} from "../whatsapp/handlers.js";


type RegisterStep =
    | "name"
    | "price"
    | "url"
    | "image"
    | "category"
    | "priority"
    | "note";


type EditStep =
    | "name"
    | "price"
    | "url"
    | "image"
    | "category"
    | "priority"
    | "note";


interface RegisterDraft {

    name?: string;

    price?: number | null;

    url?: string | null;

    imageUrl?: string | null;

    category?: string;

    priority?: Priority;

    note?: string | null;
}


interface RegisterFlow {

    type: "register";

    step: RegisterStep;

    draft: RegisterDraft;
}


interface EditFlow {

    type: "edit";

    itemId: number;

    step: EditStep;

    before: WishlistItem;

    draft: RegisterDraft;
}


type PendingFlow =
    | RegisterFlow
    | EditFlow;


const pending =
    new Map<
        string,
        PendingFlow
    >();


function parsePrice(
    value?: string,
): number | null {

    if (!value) {

        return null;
    }


    const normalized =
        value
            .trim()
            .replace(
                /R\$\s?/gi,
                "",
            )
            .replace(
                /\./g,
                "",
            )
            .replace(
                ",",
                ".",
            );


    const number =
        Number(
            normalized,
        );


    return Number.isFinite(
        number,
    )
        ? number
        : null;
}


function parsePriority(
    value?: string,
): Priority | null {

    const number =
        Number(
            value,
        );


    if (
        number === 1 ||
        number === 2 ||
        number === 3 ||
        number === 4
    ) {

        return number;
    }


    return null;
}


function parseIds(
    args: string[],
): number[] {

    return [

        ...new Set(

            args
                .flatMap(
                    (
                        arg,
                    ) =>
                        arg.split(","),
                )

                .map(
                    (
                        value,
                    ) =>
                        Number(
                            value.trim(),
                        ),
                )

                .filter(
                    (
                        id,
                    ) =>
                        Number.isInteger(
                            id,
                        ) &&
                        id > 0,
                ),
        ),
    ];
}


function isIdArgument(
    value: string,
): boolean {

    const parts =
        value.split(",");


    return parts.every(
        (
            part,
        ) => {

            const id =
                Number(
                    part.trim(),
                );


            return (
                Number.isInteger(
                    id,
                ) &&
                id > 0
            );
        },
    );
}


function requireId(
    ctx: CommandContext,
): number | null {

    const id =
        Number(
            ctx.args[0],
        );


    return Number.isInteger(
        id,
    ) && id > 0
        ? id
        : null;
}


async function getDbUser(
    jid: string,
) {

    return getOrCreateUser(
        jid,
    );
}


export function getPending(
    jid: string,
): PendingFlow | undefined {

    return pending.get(
        jid,
    );
}


/* =========================================================
 * REGISTER FLOW
 * ========================================================= */

async function continueRegister(
    ctx: CommandContext,
    flow: RegisterFlow,
    value: string,
): Promise<boolean> {

    switch (
        flow.step
    ) {

        case "name": {

            if (!value) {

                await ctx.reply(
                    "Name cannot be empty.",
                );

                return true;
            }


            flow.draft.name =
                value;


            flow.step =
                "price";


            await ctx.reply(
                "Price? Send - to skip.",
            );


            return true;
        }


        case "price": {

            flow.draft.price =
                value === "-"
                    ? null
                    : parsePrice(
                        value,
                    );


            if (
                value !== "-" &&
                flow.draft.price === null
            ) {

                await ctx.reply(
                    "Invalid price. Example: 199.90 or 199,90",
                );

                return true;
            }


            flow.step =
                "url";


            await ctx.reply(
                "Product URL? Send - to skip.",
            );


            return true;
        }


        case "url": {

            flow.draft.url =
                value === "-"
                    ? null
                    : value;


            flow.step =
                "image";


            await ctx.reply(
                "Image URL? Send - to skip.",
            );


            return true;
        }


        case "image": {

            flow.draft.imageUrl =
                value === "-"
                    ? null
                    : value;


            flow.step =
                "category";


            await ctx.reply(
                "Category? Send - for nonclass.",
            );


            return true;
        }


        case "category": {

            flow.draft.category =
                value === "-"
                    ? "nonclass"
                    : value
                        .toLowerCase();


            flow.step =
                "priority";


            await ctx.reply(
                [

                    "Priority / necessity:",

                    "",

                    "1 🟢 Low",

                    "2 🟡 Medium",

                    "3 🔴 High",

                    "4 🚨 Critical",

                ].join("\n"),
            );


            return true;
        }


        case "priority": {

            const priority =
                parsePriority(
                    value,
                );


            if (!priority) {

                await ctx.reply(
                    "Choose 1, 2, 3 or 4.",
                );

                return true;
            }


            flow.draft.priority =
                priority;


            flow.step =
                "note";


            await ctx.reply(
                "Note? Send - to skip.",
            );


            return true;
        }


        case "note": {

            flow.draft.note =
                value === "-"
                    ? null
                    : value;


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const item =
                await createItem(
                    user.id,
                    {

                        name:
                            flow.draft.name!,

                        price:
                            flow.draft.price,

                        url:
                            flow.draft.url,

                        imageUrl:
                            flow.draft.imageUrl,

                        category:
                            flow.draft.category,

                        priority:
                            flow.draft.priority,

                        note:
                            flow.draft.note,
                    },
                );


            pending.delete(
                ctx.jid,
            );


            /*
             * Save creation for undo.
             */

            await saveUndo(
                user.id,
                {

                    type:
                        "create",

                    item:
                        structuredClone(
                            item,
                        ),
                },
            );


            await ctx.reply(
                `Added:\n\n${formatItem(item)}`,
                {

                    imageUrl:
                        item.imageUrl,
                },
            );


            return true;
        }
    }
}


/* =========================================================
 * EDIT FLOW
 * ========================================================= */

async function continueEdit(
    ctx: CommandContext,
    flow: EditFlow,
    value: string,
): Promise<boolean> {

    switch (
        flow.step
    ) {

        case "name": {

            if (!value) {

                await ctx.reply(
                    "Name cannot be empty.",
                );

                return true;
            }


            flow.draft.name =
                value;


            flow.step =
                "price";


            await ctx.reply(
                [
                    `Current price: ${formatMoney(flow.before.price)}`,
                    "New price? Send - to clear.",
                ].join("\n"),
            );


            return true;
        }


        case "price": {

            if (
                value === "-"
            ) {

                flow.draft.price =
                    null;

            } else {

                const price =
                    parsePrice(
                        value,
                    );


                if (
                    price === null
                ) {

                    await ctx.reply(
                        "Invalid price. Example: 199.90 or 199,90",
                    );

                    return true;
                }


                flow.draft.price =
                    price;
            }


            flow.step =
                "url";


            await ctx.reply(
                [
                    `Current URL: ${flow.before.url ?? "—"}`,
                    "New URL? Send - to clear.",
                ].join("\n"),
            );


            return true;
        }


        case "url": {

            flow.draft.url =
                value === "-"
                    ? null
                    : value;


            flow.step =
                "image";


            await ctx.reply(
                [
                    `Current image: ${flow.before.imageUrl ?? "—"}`,
                    "New image URL? Send - to clear.",
                ].join("\n"),
            );


            return true;
        }


        case "image": {

            flow.draft.imageUrl =
                value === "-"
                    ? null
                    : value;


            flow.step =
                "category";


            await ctx.reply(
                [
                    `Current category: ${flow.before.category}`,
                    "New category? Send - for nonclass.",
                ].join("\n"),
            );


            return true;
        }


        case "category": {

            flow.draft.category =
                value === "-"
                    ? "nonclass"
                    : value.toLowerCase();


            flow.step =
                "priority";


            await ctx.reply(
                [

                    `Current priority: ${priorityLabel(flow.before.priority)}`,

                    "",

                    "New priority:",

                    "1 🟢 Low",

                    "2 🟡 Medium",

                    "3 🔴 High",

                    "4 🚨 Critical",

                ].join("\n"),
            );


            return true;
        }


        case "priority": {

            const priority =
                parsePriority(
                    value,
                );


            if (!priority) {

                await ctx.reply(
                    "Choose 1, 2, 3 or 4.",
                );

                return true;
            }


            flow.draft.priority =
                priority;


            flow.step =
                "note";


            await ctx.reply(
                [

                    `Current note: ${flow.before.note ?? "—"}`,

                    "New note? Send - to clear.",

                ].join("\n"),
            );


            return true;
        }


        case "note": {

            flow.draft.note =
                value === "-"
                    ? null
                    : value;


            const user =
                await getDbUser(
                    ctx.jid,
                );


            await updateItem(
                user.id,
                flow.itemId,
                {

                    name:
                        flow.draft.name,

                    price:
                        flow.draft.price,

                    url:
                        flow.draft.url,

                    imageUrl:
                        flow.draft.imageUrl,

                    category:
                        flow.draft.category,

                    priority:
                        flow.draft.priority,

                    note:
                        flow.draft.note,
                },
            );


            const updated =
                await findItem(
                    user.id,
                    flow.itemId,
                );


            pending.delete(
                ctx.jid,
            );


            await saveUndo(
                user.id,
                {

                    type:
                        "update",

                    itemId:
                        flow.itemId,

                    before:
                        structuredClone(
                            flow.before,
                        ),
                },
            );


            if (!updated) {

                await ctx.reply(
                    "❌ Item disappeared while editing.",
                );

                return true;
            }


            await ctx.reply(
                `✏️ Edited:\n\n${formatItem(updated)}`,
                {

                    imageUrl:
                        updated.imageUrl,
                },
            );


            return true;
        }
    }
}


/* =========================================================
 * CONTINUE PENDING
 * ========================================================= */

export async function continuePending(
    ctx: CommandContext,
    text: string,
): Promise<boolean> {

    const flow =
        pending.get(
            ctx.jid,
        );


    if (!flow) {

        return false;
    }


    const value =
        text.trim();


    /*
     * Commands always have priority.
     *
     * This prevents "!cancel" from becoming
     * the item name during a guided flow.
     */

    if (
        value.startsWith(
            config.prefix,
        )
    ) {

        return false;
    }


    if (
        flow.type ===
        "register"
    ) {

        return continueRegister(
            ctx,
            flow,
            value,
        );
    }


    return continueEdit(
        ctx,
        flow,
        value,
    );
}


/* =========================================================
 * PING
 * ========================================================= */

register({

    name:
        "ping",

    usage:
        "!ping",

    description:
        "Tests the bot connection",

    handler:
        async (
            ctx,
        ) => {

            await ctx.reply(
                "🏓 Pong!",
            );
        },
});


/* =========================================================
 * REGISTER
 * ========================================================= */

register({

    name:
        "register",

    aliases:
        [
            "add",
        ],

    usage:
        "!register",

    description:
        "Adds an item using guided registration",

    handler:
        async (
            ctx,
        ) => {

            pending.set(
                ctx.jid,
                {

                    type:
                        "register",

                    step:
                        "name",

                    draft:
                        {},
                },
            );


            await ctx.reply(
                [

                    "📦 Registering a new item.",

                    "",

                    "What is the item name?",

                    `${config.prefix}cancel to abort.`,

                ].join("\n"),
            );
        },
});


/* =========================================================
 * EDIT
 * ========================================================= */

register({

    name:
        "edit",

    usage:
        "!edit <id>",

    description:
        "Edits an item using guided editing",

    handler:
        async (
            ctx,
        ) => {

            const id =
                requireId(
                    ctx,
                );


            if (!id) {

                await ctx.reply(
                    "Usage: !edit <id>",
                );

                return;
            }


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const item =
                await findItem(
                    user.id,
                    id,
                );


            if (!item) {

                await ctx.reply(
                    "Item not found.",
                );

                return;
            }


            pending.set(
                ctx.jid,
                {

                    type:
                        "edit",

                    itemId:
                        id,

                    step:
                        "name",

                    before:
                        structuredClone(
                            item,
                        ),

                    draft:
                        {},
                },
            );


            await ctx.reply(
                [

                    `✏️ Editing [${item.id}] ${item.name}`,

                    "",

                    `Current name: ${item.name}`,

                    "New name?",

                    "",

                    `${config.prefix}cancel to abort.`,

                ].join("\n"),
            );
        },
});


/* =========================================================
 * DELETE
 * ========================================================= */

register({

    name:
        "delete",

    aliases:
        [
            "remove",
        ],

    usage:
        "!delete <id...> OR !delete class <category>",

    description:
        "Deletes items or moves a category to nonclass",

    handler:
        async (
            ctx,
        ) => {

            /*
             * DELETE CLASS
             */

            if (
                ctx.args[0]
                    ?.toLowerCase() ===
                "class"
            ) {

                const category =
                    ctx.args
                        .slice(1)
                        .join(" ")
                        .trim()
                        .toLowerCase();


                if (!category) {

                    await ctx.reply(
                        "Usage: !delete class <category>",
                    );

                    return;
                }


                if (
                    category ===
                    "nonclass"
                ) {

                    await ctx.reply(
                        "The nonclass category cannot be deleted.",
                    );

                    return;
                }


                const user =
                    await getDbUser(
                        ctx.jid,
                    );


                const items =
                    await listItems(
                        user.id,
                    );


                const classItems =
                    items.filter(
                        (
                            item,
                        ) =>
                            item.category ===
                            category,
                    );


                if (
                    classItems.length ===
                    0
                ) {

                    await ctx.reply(
                        `Category "${category}" not found or empty.`,
                    );

                    return;
                }


                await saveUndo(
                    user.id,
                    {

                        type:
                            "batch_update",

                        items:
                            classItems.map(
                                (
                                    item,
                                ) => ({

                                    itemId:
                                        item.id,

                                    before:
                                        structuredClone(
                                            item,
                                        ),
                                }),
                            ),
                    },
                );


                for (
                    const item
                    of classItems
                ) {

                    await updateItem(
                        user.id,
                        item.id,
                        {

                            category:
                                "nonclass",
                        },
                    );
                }


                await ctx.reply(
                    [

                        `📂 Category "${category}" deleted.`,

                        "",

                        `${classItems.length} item(s) moved to nonclass.`,

                    ].join("\n"),
                );


                return;
            }


            /*
             * DELETE IDS
             */

            const ids =
                parseIds(
                    ctx.args,
                );


            if (
                ids.length === 0
            ) {

                await ctx.reply(
                    "Usage: !delete <id...>",
                );

                return;
            }


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const items:
                WishlistItem[] =
                [];


            for (
                const id of ids
            ) {

                const item =
                    await findItem(
                        user.id,
                        id,
                    );


                if (item) {

                    items.push(
                        item,
                    );
                }
            }


            if (
                items.length ===
                0
            ) {

                await ctx.reply(
                    "No valid items found.",
                );

                return;
            }


            await saveUndo(
                user.id,
                {

                    type:
                        "batch_delete",

                    items:
                        items.map(
                            (
                                item,
                            ) =>
                                structuredClone(
                                    item,
                                ),
                        ),
                },
            );


            for (
                const item
                of items
            ) {

                await deleteItem(
                    user.id,
                    item.id,
                );
            }


            await ctx.reply(
                [

                    `🗑️ Deleted ${items.length} item(s):`,

                    "",

                    ...items.map(
                        (
                            item,
                        ) =>
                            `• [${item.id}] ${item.name}`,
                    ),

                ].join("\n"),
            );
        },
});


/* =========================================================
 * SHOW
 * ========================================================= */

register({

    name:
        "show",

    usage:
        "!show <id>",

    description:
        "Shows complete information about an item",

    handler:
        async (
            ctx,
        ) => {

            const id =
                requireId(
                    ctx,
                );


            if (!id) {

                await ctx.reply(
                    "Usage: !show <id>",
                );

                return;
            }


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const item =
                await findItem(
                    user.id,
                    id,
                );


            if (!item) {

                await ctx.reply(
                    "Item not found.",
                );

                return;
            }


            await ctx.reply(
                formatItem(
                    item,
                ),
                {

                    imageUrl:
                        item.imageUrl,
                },
            );
        },
});


/* =========================================================
 * CLEAR
 * ========================================================= */

register({

    name:
        "clear",

    usage:
        "!clear",

    description:
        "Deletes bot messages in the current chat",

    handler:
        async (
            ctx,
        ) => {

            const messages =
                getSentMessages(
                    ctx.jid,
                );


            let deleted =
                0;


            for (
                const message
                of messages
            ) {

                try {

                    await ctx.socket.sendMessage(
                        ctx.jid,
                        {

                            delete:
                                message.key,
                        },
                    );


                    forgetSentMessage(
                        ctx.jid,
                        message.key.id ??
                            undefined,
                    );


                    deleted++;

                } catch (
                    error
                ) {

                    console.error(
                        `[CLEAR ERROR] ${message.key.id}:`,
                        error,
                    );
                }
            }


            clearSentMessages(
                ctx.jid,
            );


            await ctx.reply(
                `🧹 Cleared ${deleted} bot message(s).`,
            );
        },
});


/* =========================================================
 * BUY
 * ========================================================= */

register({

    name:
        "buy",

    usage:
        "!buy <id>",

    description:
        "Marks an item as bought",

    handler:
        async (
            ctx,
        ) => {

            const id =
                requireId(
                    ctx,
                );


            if (!id) {

                await ctx.reply(
                    "Usage: !buy <id>",
                );

                return;
            }


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const item =
                await findItem(
                    user.id,
                    id,
                );


            if (!item) {

                await ctx.reply(
                    "Item not found.",
                );

                return;
            }


            await saveUndo(
                user.id,
                {

                    type:
                        "update",

                    itemId:
                        id,

                    before:
                        structuredClone(
                            item,
                        ),
                },
            );


            await updateItem(
                user.id,
                id,
                {

                    bought:
                        true,
                },
            );


            await ctx.reply(
                `🎉 Bought: ${item.name}`,
            );
        },
});


/* =========================================================
 * UNBUY
 * ========================================================= */

register({

    name:
        "unbuy",

    usage:
        "!unbuy <id>",

    description:
        "Marks an item as not bought",

    handler:
        async (
            ctx,
        ) => {

            const id =
                requireId(
                    ctx,
                );


            if (!id) {

                await ctx.reply(
                    "Usage: !unbuy <id>",
                );

                return;
            }


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const item =
                await findItem(
                    user.id,
                    id,
                );


            if (!item) {

                await ctx.reply(
                    "Item not found.",
                );

                return;
            }


            await saveUndo(
                user.id,
                {

                    type:
                        "update",

                    itemId:
                        id,

                    before:
                        structuredClone(
                            item,
                        ),
                },
            );


            await updateItem(
                user.id,
                id,
                {

                    bought:
                        false,
                },
            );


            await ctx.reply(
                `↩️ Returned to wishlist: ${item.name}`,
            );
        },
});


/* =========================================================
 * LIST
 * ========================================================= */

register({

    name:
        "list",

    usage:
        "!list [category]",

    description:
        "Lists items from a category or all items",

    handler:
        async (
            ctx,
        ) => {

            const user =
                await getDbUser(
                    ctx.jid,
                );


            let items =
                await listItems(
                    user.id,
                );


            const category =
                ctx.rest
                    .trim()
                    .toLowerCase();


            if (category) {

                items =
                    items.filter(
                        (
                            item,
                        ) =>
                            item.category ===
                            category,
                    );
            }


            if (
                items.length ===
                0
            ) {

                await ctx.reply(
                    "Nothing found.",
                );

                return;
            }


            await ctx.reply(
                items
                    .map(
                        (
                            item,
                        ) =>
                            [

                                `${item.bought ? "✅" : "▫️"} [${item.id}] ${item.name}`,

                                `💰 ${formatMoney(item.price)}`,

                                `${priorityLabel(item.priority)}`,

                            ].join(" | "),
                    )
                    .join("\n"),
            );
        },
});


/* =========================================================
 * CLASSES
 * ========================================================= */

register({

    name:
        "classes",

    aliases:
        [
            "class",
            "categories",
        ],

    usage:
        "!classes",

    description:
        "Lists all categories",

    handler:
        async (
            ctx,
        ) => {

            const user =
                await getDbUser(
                    ctx.jid,
                );


            const items =
                await listItems(
                    user.id,
                );


            const categories =
                [
                    ...new Set(
                        items.map(
                            (
                                item,
                            ) =>
                                item.category,
                        ),
                    ),
                ].sort();


            if (
                categories.length ===
                0
            ) {

                await ctx.reply(
                    "No categories found.",
                );

                return;
            }


            await ctx.reply(
                [

                    "📂 Classes:",

                    "",

                    ...categories.map(
                        (
                            category,
                        ) =>
                            `• ${category}`,
                    ),

                ].join("\n"),
            );
        },
});


/* =========================================================
 * BUDGET
 * ========================================================= */

register({

    name:
        "budget",

    usage:
        "!budget <value>",

    description:
        "Sets your available budget",

    handler:
        async (
            ctx,
        ) => {

            const value =
                ctx.rest.trim();


            const user =
                await getDbUser(
                    ctx.jid,
                );


            if (!value) {

                await ctx.reply(
                    `Current budget: ${formatMoney(user.budget)}`,
                );

                return;
            }


            const budget =
                parsePrice(
                    value,
                );


            if (
                budget === null ||
                budget < 0
            ) {

                await ctx.reply(
                    "Invalid budget.",
                );

                return;
            }


            await updateBudget(
                user.id,
                budget,
            );


            await ctx.reply(
                `Budget set to ${formatMoney(budget)}`,
            );
        },
});


/* =========================================================
 * SEARCH
 * ========================================================= */

register({

    name:
        "search",

    usage:
        "!search <term>",

    description:
        "Searches by name, category or note",

    handler:
        async (
            ctx,
        ) => {

            const term =
                ctx.rest
                    .trim()
                    .toLowerCase();


            if (!term) {

                await ctx.reply(
                    "Usage: !search <term>",
                );

                return;
            }


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const items =
                await searchItems(
                    user.id,
                    term,
                );


            await ctx.reply(
                items.length

                    ? items
                        .map(
                            formatItem,
                        )
                        .join(
                            "\n\n",
                        )

                    : `Nothing found for "${term}".`,
            );
        },
});


/* =========================================================
 * RANDOM
 * ========================================================= */

register({

    name:
        "random",

    usage:
        "!random",

    description:
        "Picks a random open item",

    handler:
        async (
            ctx,
        ) => {

            const user =
                await getDbUser(
                    ctx.jid,
                );


            const items =
                (
                    await listItems(
                        user.id,
                    )
                ).filter(
                    (
                        item,
                    ) =>
                        !item.bought,
                );


            if (
                items.length ===
                0
            ) {

                await ctx.reply(
                    "No open items.",
                );

                return;
            }


            const item =
                items[
                    Math.floor(
                        Math.random() *
                        items.length,
                    )
                ]!;


            await ctx.reply(
                `How about this?\n\n${formatItem(item)}`,
                {

                    imageUrl:
                        item.imageUrl,
                },
            );
        },
});


/* =========================================================
 * SUMMARY
 * ========================================================= */

register({

    name:
        "summary",

    usage:
        "!summary",

    description:
        "Shows wishlist summary",

    handler:
        async (
            ctx,
        ) => {

            const user =
                await getDbUser(
                    ctx.jid,
                );


            const items =
                await listItems(
                    user.id,
                );


            const open =
                items.filter(
                    (
                        item,
                    ) =>
                        !item.bought,
                );


            const bought =
                items.filter(
                    (
                        item,
                    ) =>
                        item.bought,
                );


            const total =
                (
                    values:
                        WishlistItem[],
                ) =>
                    values.reduce(
                        (
                            sum,
                            item,
                        ) =>
                            sum +
                            (
                                item.price ??
                                0
                            ),
                        0,
                    );


            const critical =
                open.filter(
                    (
                        item,
                    ) =>
                        item.priority ===
                        4,
                );


            const high =
                open.filter(
                    (
                        item,
                    ) =>
                        item.priority ===
                        3,
                );


            const openTotal =
                total(
                    open,
                );


            const priorityTotal =
                total(
                    critical,
                ) +
                total(
                    high,
                );


            const remaining =
                user.budget ===
                null

                    ? null

                    : user.budget -
                    openTotal;


            await ctx.reply(
                [

                    "*📦 My WishBox Summary*",

                    "",

                    `Total items: ${items.length}`,

                    `Open: ${open.length} (${formatMoney(openTotal)})`,

                    `Bought: ${bought.length} (${formatMoney(total(bought))})`,

                    "",

                    `🚨 Critical: ${critical.length} (${formatMoney(total(critical))})`,

                    `🔴 High: ${high.length} (${formatMoney(total(high))})`,

                    `🔥 Critical + High: ${formatMoney(priorityTotal)}`,

                    "",

                    `💰 Budget: ${formatMoney(user.budget)}`,

                    `📉 Remaining after all open items: ${formatMoney(remaining)}`,

                ].join("\n"),
            );
        },
});


/* =========================================================
 * MOVE
 * ========================================================= */

register({

    name:
        "move",

    usage:
        "!move <id...> <category>",

    description:
        "Moves one or multiple items to another category",

    handler:
        async (
            ctx,
        ) => {

            if (
                ctx.args.length <
                2
            ) {

                await ctx.reply(
                    "Usage: !move <id...> <category>",
                );

                return;
            }


            let idEnd =
                0;


            while (

                idEnd <
                    ctx.args.length &&

                isIdArgument(
                    ctx.args[
                        idEnd
                    ]!,
                )

            ) {

                idEnd++;
            }


            if (
                idEnd ===
                0 ||
                idEnd >=
                ctx.args.length
            ) {

                await ctx.reply(
                    "Usage: !move <id...> <category>",
                );

                return;
            }


            const ids =
                parseIds(
                    ctx.args.slice(
                        0,
                        idEnd,
                    ),
                );


            const category =
                ctx.args
                    .slice(
                        idEnd,
                    )
                    .join(" ")
                    .trim()
                    .toLowerCase();


            if (
                ids.length ===
                0 ||
                !category
            ) {

                await ctx.reply(
                    "Usage: !move <id...> <category>",
                );

                return;
            }


            const user =
                await getDbUser(
                    ctx.jid,
                );


            const items:
                WishlistItem[] =
                [];


            for (
                const id
                of ids
            ) {

                const item =
                    await findItem(
                        user.id,
                        id,
                    );


                if (item) {

                    items.push(
                        item,
                    );
                }
            }


            if (
                items.length ===
                0
            ) {

                await ctx.reply(
                    "No valid items found.",
                );

                return;
            }


            const movableItems =
                items.filter(
                    (
                        item,
                    ) =>
                        item.category !==
                        category,
                );


            if (
                movableItems.length ===
                0
            ) {

                await ctx.reply(
                    `All selected items are already in "${category}".`,
                );

                return;
            }


            await saveUndo(
                user.id,
                {

                    type:
                        "batch_update",

                    items:
                        movableItems.map(
                            (
                                item,
                            ) => ({

                                itemId:
                                    item.id,

                                before:
                                    structuredClone(
                                        item,
                                    ),
                            }),
                        ),
                },
            );


            for (
                const item
                of movableItems
            ) {

                await updateItem(
                    user.id,
                    item.id,
                    {

                        category,
                    },
                );
            }


            await ctx.reply(
                [

                    `📦 Moved ${movableItems.length} item(s) to "${category}":`,

                    "",

                    ...movableItems.map(
                        (
                            item,
                        ) =>
                            `• [${item.id}] ${item.name}: ${item.category} → ${category}`,
                    ),

                ].join("\n"),
            );
        },
});


/* =========================================================
 * UNDO
 * ========================================================= */

register({

    name:
        "undo",

    usage:
        "!undo",

    description:
        "Undoes the last modification",

    handler:
        async (
            ctx,
        ) => {

            const user =
                await getDbUser(
                    ctx.jid,
                );


            const action =
                await consumeUndo(
                    user.id,
                );


            if (!action) {

                await ctx.reply(
                    "Nothing to undo.",
                );

                return;
            }


            try {

                switch (
                    action.type
                ) {

                    /*
                     * CREATE
                     */

                    case "create": {

                        const existing =
                            await findItem(
                                user.id,
                                action.item.id,
                            );


                        if (!existing) {

                            await ctx.reply(
                                "Cannot undo: item no longer exists.",
                            );

                            return;
                        }


                        await deleteItem(
                            user.id,
                            action.item.id,
                        );


                        await ctx.reply(
                            `↩️ Undone: [${action.item.id}] ${action.item.name} removed.`,
                        );


                        return;
                    }


                    /*
                     * DELETE
                     */

                    case "delete": {

                        const existing =
                            await findItem(
                                user.id,
                                action.item.id,
                            );


                        if (existing) {

                            await ctx.reply(
                                `Item [${action.item.id}] already exists.`,
                            );

                            return;
                        }


                        await restoreItem(
                            user.id,
                            action.item,
                        );


                        await ctx.reply(
                            `↩️ Restored: [${action.item.id}] ${action.item.name}`,
                        );


                        return;
                    }


                    /*
                     * UPDATE
                     */

                    case "update": {

                        const current =
                            await findItem(
                                user.id,
                                action.itemId,
                            );


                        if (!current) {

                            await ctx.reply(
                                "Cannot undo: item no longer exists.",
                            );

                            return;
                        }


                        await updateItem(
                            user.id,
                            action.itemId,
                            {

                                name:
                                    action.before.name,

                                price:
                                    action.before.price,

                                url:
                                    action.before.url,

                                imageUrl:
                                    action.before.imageUrl,

                                category:
                                    action.before.category,

                                priority:
                                    action.before.priority,

                                bought:
                                    action.before.bought,

                                note:
                                    action.before.note,
                            },
                        );


                        await ctx.reply(
                            [

                                `↩️ Undo: [${action.itemId}] ${action.before.name}`,

                                "",

                                `📂 Restored category: ${action.before.category}`,

                            ].join("\n"),
                        );


                        return;
                    }


                    /*
                     * BATCH UPDATE
                     */

                    case "batch_update": {

                        let restored =
                            0;


                        for (
                            const entry
                            of action.items
                        ) {

                            const current =
                                await findItem(
                                    user.id,
                                    entry.itemId,
                                );


                            if (!current) {

                                continue;
                            }


                            await updateItem(
                                user.id,
                                entry.itemId,
                                {

                                    name:
                                        entry.before.name,

                                    price:
                                        entry.before.price,

                                    url:
                                        entry.before.url,

                                    imageUrl:
                                        entry.before.imageUrl,

                                    category:
                                        entry.before.category,

                                    priority:
                                        entry.before.priority,

                                    bought:
                                        entry.before.bought,

                                    note:
                                        entry.before.note,
                                },
                            );


                            restored++;
                        }


                        await ctx.reply(
                            [

                                `↩️ Undo: restored ${restored} item(s).`,

                                "",

                                ...action.items.map(
                                    (
                                        entry,
                                    ) =>
                                        `• [${entry.itemId}] ${entry.before.name}: ${entry.before.category}`,
                                ),

                            ].join("\n"),
                        );


                        return;
                    }


                    /*
                     * BATCH DELETE
                     */

                    case "batch_delete": {

                        let restored =
                            0;


                        for (
                            const item
                            of action.items
                        ) {

                            const existing =
                                await findItem(
                                    user.id,
                                    item.id,
                                );


                            if (existing) {

                                continue;
                            }


                            await restoreItem(
                                user.id,
                                item,
                            );


                            restored++;
                        }


                        await ctx.reply(
                            [

                                `↩️ Undo: restored ${restored} item(s).`,

                                "",

                                ...action.items.map(
                                    (
                                        item,
                                    ) =>
                                        `• [${item.id}] ${item.name}`,
                                ),

                            ].join("\n"),
                        );


                        return;
                    }
                }

            } catch (
                error
            ) {

                console.error(
                    "[UNDO ERROR]",
                    error,
                );


                await ctx.reply(
                    "❌ Failed to undo the last action.",
                );
            }
        },
});


/* =========================================================
 * CANCEL
 * ========================================================= */

register({

    name:
        "cancel",

    usage:
        "!cancel",

    description:
        "Cancels the current guided flow",

    handler:
        async (
            ctx,
        ) => {

            const cancelled =
                pending.delete(
                    ctx.jid,
                );


            await ctx.reply(
                cancelled
                    ? "Flow cancelled."
                    : "No active flow.",
            );
        },
});


/* =========================================================
 * HELP
 * ========================================================= */

register({

    name:
        "help",

    aliases:
        [
            "commands",
        ],

    usage:
        "!help",

    description:
        "Shows all commands",

    handler:
        async (
            ctx,
        ) => {

            const output = [

                "*📦 My WishBox*",

                "",

                ...list().map(
                    (
                        command,
                    ) =>
                        `${command.usage}\n${command.description}`,
                ),

                "",

                "*Priority*",

                "1 🟢 Low",

                "2 🟡 Medium",

                "3 🔴 High",

                "4 🚨 Critical",

            ];


            await ctx.reply(
                output.join(
                    "\n\n",
                ),
            );
        },
});