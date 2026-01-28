import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
    region: process.env.WASABI_REGION ?? "eu-central-1",
    endpoint:
        process.env.WASABI_ENDPOINT ?? "https://s3.eu-central-1.wasabisys.com",
    credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY ?? "",
        secretAccessKey: process.env.WASABI_SECRET_KEY ?? "",
    },
});

export const BUCKET_NAME = process.env.WASABI_BUCKET_NAME ?? "";

export async function signPosterUrl(url: string | null, expiresIn: number = 3600): Promise<string | null> {
    if (!url) return null;

    // Check if it's a Wasabi URL
    if (!url.includes("wasabisys.com")) {
        return url; // Return as is for external images or placeholders
    }

    try {
        // Extract key from URL
        // Format: https://s3.eu-central-1.wasabisys.com/bucket-name/KEY
        // OR: https://bucket-name.s3.eu-central-1.wasabisys.com/KEY

        // Simple heuristic: take everything after the last slash
        const key = url.split("/").pop();

        if (!key) return url;

        // Verify bucket name is in env
        if (!BUCKET_NAME) {
            console.warn("WASABI_BUCKET_NAME not set");
            return url;
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        // Generate signed URL
        const signedUrl = await getSignedUrl(s3, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error("Error signing URL:", error);
        return url; // Fallback to original URL
    }
}
