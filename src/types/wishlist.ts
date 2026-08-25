export type Priority =
    | 1
    | 2
    | 3
    | 4;


export interface WishlistItem {

    id: number;

    name: string;

    price: number | null;

    url: string | null;

    imageUrl: string | null;

    category: string;

    priority: Priority;

    bought: boolean;

    note: string | null;

    createdAt: string;

    updatedAt: string;
}


export interface UserData {

    id: number;

    jid: string;

    budget: number | null;
}