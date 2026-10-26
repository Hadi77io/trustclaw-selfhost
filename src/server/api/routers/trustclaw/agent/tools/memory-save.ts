import { zodSchema } from "ai";
import { embedText } from "~/server/clients/llm";
import type { Tool } from "ai";
import { db } from "~/server/clients/db";
import { memorySaveSchema, type MemorySaveInput } from "./memory-save.schema";

export function createMemorySaveTool(
  instanceId: string,
): Tool<MemorySaveInput, { saved: boolean; content: string }> {
  return {
    description: "Save an important fact or observation for future reference",
    inputSchema: zodSchema(memorySaveSchema),
    execute: async ({ content }) => {
      const embedding = await embedText(content);
      const embeddingString = `[${embedding.join(",")}]`;
      const id = crypto.randomUUID();

      await db.$queryRaw`
        INSERT INTO composio_claw_memory (id, "instanceId", content, embedding, "createdAt")
        VALUES (${id}, ${instanceId}, ${content}, ${embeddingString}::vector, NOW())
      `;

      return { saved: true, content };
    },
  };
}
