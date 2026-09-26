"use client";

import { Code2, Sparkles } from "lucide-react";

export default function DeveloperBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`dev-badge ${compact ? "compact" : ""}`} aria-label="Geliştirici yaaertu codeR">
      <div className="dev-orbit" aria-hidden="true">
        <span className="orbit-dot" />
        <Code2 size={compact ? 15 : 18} />
      </div>
      <div className="dev-copy">
        {!compact && <span className="dev-label">Geliştirici</span>}
        <strong>
          yaaertu <span>codeR</span>
        </strong>
      </div>
      {!compact && <Sparkles className="dev-spark" size={16} />}
    </div>
  );
}
