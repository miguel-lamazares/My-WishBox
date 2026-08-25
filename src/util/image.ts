export async function downloadImage(
    url: string,
): Promise<Buffer> {

    const response =
        await fetch(
            url,
            {
                redirect:
                    "follow",
            },
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Failed to download image: HTTP ${response.status}`,
        );
    }


    const contentType =
        response.headers.get(
            "content-type",
        );


    if (
        contentType &&
        !contentType
            .toLowerCase()
            .startsWith("image/")
    ) {

        throw new Error(
            `URL did not return an image: ${contentType}`,
        );
    }


    const maxSize =
        10 * 1024 * 1024;


    const contentLength =
        response.headers.get(
            "content-length",
        );


    if (contentLength) {

        const size =
            Number(
                contentLength,
            );


        if (
            Number.isFinite(size) &&
            size > maxSize
        ) {

            throw new Error(
                "Image is larger than 10 MB.",
            );
        }
    }


    const arrayBuffer =
        await response.arrayBuffer();


    const buffer =
        Buffer.from(
            arrayBuffer,
        );


    if (
        buffer.length >
        maxSize
    ) {

        throw new Error(
            "Image is larger than 10 MB.",
        );
    }


    return buffer;
}