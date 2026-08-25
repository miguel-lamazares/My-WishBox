import {
    migrate,
} from "./db/migrate.js";


import {
    startWhatsApp,
} from "./whatsapp/client.js";


async function main() {

    console.log(
        "Starting My WishBox...",
    );


    await migrate();


    await startWhatsApp();
}


main().catch(
    (
        error,
    ) => {

        console.error(
            "Failed to start My WishBox:",
            error,
        );


        process.exit(
            1,
        );
    },
);