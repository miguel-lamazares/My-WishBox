import type {
    WAMessage,
    WASocket,
} from "baileys";


export interface ReplyOptions {

    imageUrl?: string | null;
}


export interface CommandContext {

    socket: WASocket;

    message: WAMessage;

    jid: string;

    args: string[];

    rest: string;

    reply: (
        text: string,
        options?: ReplyOptions,
    ) => Promise<void>;
}


export interface Command {

    name: string;

    aliases?: string[];

    usage: string;

    description: string;

    handler: (
        ctx: CommandContext,
    ) => Promise<void>;
}


const commands =
    new Map<string, Command>();


export function register(
    command: Command,
): void {

    const name =
        command.name.toLowerCase();


    commands.set(
        name,
        command,
    );


    for (
        const alias
        of command.aliases ?? []
    ) {

        commands.set(
            alias.toLowerCase(),
            command,
        );
    }
}


export function resolve(
    name: string,
): Command | undefined {

    return commands.get(
        name.toLowerCase(),
    );
}


export function list(): Command[] {

    return [
        ...new Set(
            commands.values(),
        ),
    ];
}