"use client";

import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

const theme = {
  ...atomOneDark,
  hljs: {
    ...atomOneDark.hljs,
    background: "transparent",
    padding: 0,
  },
};

type Props = {
  code: string;
  language?: string;
  highlightLines?: string[]; // substrings — lines containing any of these get a green bg
};

export default function CodeBlock({ code, language = "javascript", highlightLines = [] }: Props) {
  const lines = code.split("\n");

  const isHighlighted = (line: string) =>
    highlightLines.some((key) => line.includes(`"${key}"`));

  return (
    <SyntaxHighlighter
      language={language}
      style={theme}
      showLineNumbers
      wrapLines
      lineProps={(lineNumber) => {
        const line = lines[lineNumber - 1] ?? "";
        return isHighlighted(line)
          ? { style: { display: "block", background: "#0d2b1d60" } }
          : { style: { display: "block" } };
      }}
      lineNumberStyle={{
        color: "#484f58",
        borderRight: "1px solid #21262d",
        paddingRight: "1rem",
        marginRight: "1rem",
        minWidth: "3rem",
        textAlign: "right",
        userSelect: "none",
      }}
      customStyle={{
        margin: 0,
        padding: "12px 0",
        background: "transparent",
        fontSize: "11px",
        lineHeight: "1.6",
        overflowX: "auto",
      }}
      codeTagProps={{ style: { fontFamily: "inherit" } }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
