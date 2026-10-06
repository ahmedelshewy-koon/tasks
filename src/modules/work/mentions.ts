// Mentions are stored inline as @[Display name](userId). The display name is
// only a fallback; readers always resolve the current name from the user ID.
export const mentionPattern = /@\[([^\]\n]{1,80})\]\(([^)\s]{1,128})\)/g;

export const mentionedIds = (body: string) => [
  ...new Set([...body.matchAll(mentionPattern)].map((match) => match[2])),
];

export type CommentPart =
  | { kind: "text"; text: string }
  | { kind: "mention"; userId: string; label: string };

export function commentParts(body: string): CommentPart[] {
  const parts: CommentPart[] = [];
  let last = 0;
  for (const match of body.matchAll(mentionPattern)) {
    if (match.index > last)
      parts.push({ kind: "text", text: body.slice(last, match.index) });
    parts.push({ kind: "mention", userId: match[2], label: match[1] });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push({ kind: "text", text: body.slice(last) });
  return parts;
}
