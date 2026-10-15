"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Send,
  Paperclip,
  X,
  Feather,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { isValidBoxId } from "@/lib/box";
import { cn } from "@/lib/utils";
import type { LetterDetail } from "@/lib/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_BODY_CHARS = 10000;
const ALLOWED_EXT = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "pdf", "docx", "doc", "txt",
  "mp3", "wav", "ogg", "oga", "m4a",
]);

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}
function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface StagedFile {
  file: File;
  error?: string;
}

export function Compose({
  myBoxId,
  onSent,
  onCancel,
}: {
  myBoxId: string;
  onSent: (letter: LetterDetail) => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const recipientNorm = recipient.trim().toLowerCase();
  const recipientValid = recipientNorm.length === 0 || isValidBoxId(recipientNorm);
  const hasBody = body.trim().length > 0;
  const hasFiles = files.some((f) => !f.error);
  const canSend =
    !submitting &&
    isValidBoxId(recipientNorm) &&
    (hasBody || hasFiles) &&
    files.every((f) => !f.error);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: StagedFile[] = [];
    for (const f of Array.from(list)) {
      if (files.length + next.length >= MAX_FILES) {
        toast({
          title: "Too many files",
          description: `You can attach at most ${MAX_FILES} files per letter.`,
        });
        break;
      }
      const ext = extOf(f.name);
      let err: string | undefined;
      if (f.size > MAX_FILE_BYTES) err = "Exceeds the 10 MB limit";
      else if (!ALLOWED_EXT.has(ext)) err = "Type not allowed";
      next.push({ file: f, error: err });
    }
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!canSend) return;
    setSubmitting(true);
    try {
      const goodFiles = files.filter((f) => !f.error).map((f) => f.file);
      const letter = await api.send(recipientNorm, body, goodFiles);
      // Both lists may change (sent always; inbox if they self-addressed).
      qc.invalidateQueries({ queryKey: ["letters"] });
      toast({
        title: "Letter sealed and sent ✉",
        description: "It's on its way. Arrives in about a minute.",
      });
      onSent(letter);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Couldn't send your letter.";
      toast({ title: "Couldn't send", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Recipient / "writing desk" bar */}
      <div className="paper mb-3 flex items-center gap-3 rounded-lg border border-border/60 px-4 py-3">
        <span className="font-serif text-lg text-sepia">To</span>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="box-xxxxxxxx"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className={cn(
            "min-w-0 flex-1 bg-transparent font-mono text-base tracking-wide outline-none placeholder:text-muted-foreground/60",
            !recipientValid && "text-destructive"
          )}
        />
        {recipient.length === 0 && (
          <button
            type="button"
            onClick={() => setRecipient(myBoxId)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            Send to my own box
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Validation hint */}
      {recipient.length > 0 && !recipientValid && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle size={14} />
          That doesn't look like a valid box ID.
        </div>
      )}

      {/* The paper */}
      <div className="paper-lined relative rounded-lg border border-border/60">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_CHARS))}
          maxLength={MAX_BODY_CHARS}
          placeholder="Write your letter…"
          rows={16}
          className="letter-prose w-full resize-none bg-transparent px-6 py-5 text-base outline-none placeholder:text-muted-foreground/50"
          style={{ lineHeight: "32px" }}
        />
        {/* Signature line */}
        <div className="flex items-center justify-between px-6 pb-4 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Feather size={12} className="text-gold" />
            Letters are sealed the moment you send.
          </span>
          <span
            className={cn(
              "tabular-nums",
              body.length > MAX_BODY_CHARS - 200
                ? "text-sepia"
                : "text-muted-foreground"
            )}
          >
            {body.length.toLocaleString()} / {MAX_BODY_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Attachments */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/70 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
            disabled={files.length >= MAX_FILES}
          >
            <Paperclip size={14} />
            Attach a file
          </button>
          <span className="text-xs text-muted-foreground">
            Up to {MAX_FILES} · 10 MB each · images, PDF, docx, txt, audio
          </span>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.doc,.txt,.mp3,.wav,.ogg,.oga,.m4a"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {files.map((sf, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm"
              >
                <Paperclip size={14} className="shrink-0 text-sepia" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {sf.file.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {humanSize(sf.file.size)}
                </span>
                {sf.error && (
                  <span className="shrink-0 text-xs text-destructive">
                    {sf.error}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          disabled={submitting}
        >
          Cancel
        </button>
        <motion.button
          type="button"
          onClick={submit}
          disabled={!canSend}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-medium text-primary-foreground shadow-sm transition-colors",
            "bg-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {submitting ? "Sealing…" : "Seal & send"}
        </motion.button>
      </div>
    </div>
  );
}
