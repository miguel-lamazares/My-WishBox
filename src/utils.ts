import type {
    Priority,
    WishlistItem,
} from "./types/wishlist.js";


export function formatMoney(
    value: number | null,
): string {

    if (
        value === null
    ) {

        return "—";
    }

    return value.toLocaleString(
        "pt-BR",
        {
            style:
                "currency",

            currency:
                "BRL",
        },
    );
}


export function priorityLabel(
    priority: Priority,
): string {

    switch (
        priority
    ) {

        case 4:
            return "🚨 Critical";

        case 3:
            return "🔴 High";

        case 2:
            return "🟡 Medium";

        default:
            return "🟢 Low";
    }
}


export function formatItem(
    item: WishlistItem,
): string {

    const status =
        item.bought
            ? "✅"
            : "▫️";

    return [

        `${status} [${item.id}] ${item.name}`,

        `💰 ${formatMoney(item.price)}`,

        `📂 ${item.category}`,

        `${priorityLabel(item.priority)}`,

        item.url
            ? `🔗 ${item.url}`
            : null,

        item.note
            ? `📝 ${item.note}`
            : null,

    ]
        .filter(Boolean)
        .join("\n");
}