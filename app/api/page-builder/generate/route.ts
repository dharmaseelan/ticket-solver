import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

function getBuilderPath(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, "src", "builder"))) return path.join(projectPath, "src", "builder");
  return path.join(projectPath, "builder");
}

function getComponentsPath(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, "src", "components"))) return path.join(projectPath, "src", "components");
  return path.join(projectPath, "components");
}

function usesDynamicPattern(builderPath: string): boolean {
  try {
    const dirs = fs.readdirSync(builderPath, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const dir of dirs) {
      const compDir = path.join(builderPath, dir.name);
      if (fs.existsSync(path.join(compDir, "component.jsx")) && fs.existsSync(path.join(compDir, "index.jsx"))) {
        return true;
      }
    }
  } catch { /* */ }
  return false;
}

// Read an existing builder component + definitions as a reference example for Claude
function getBuilderExample(builderPath: string): { componentCode: string; definitions: string } | null {
  try {
    const dirs = fs.readdirSync(builderPath, { withFileTypes: true }).filter((e) => e.isDirectory());
    for (const dir of dirs) {
      const compDir = path.join(builderPath, dir.name);
      const compFile = path.join(compDir, "component.jsx");
      const defFile = path.join(compDir, "definitions.sourceflow.mjs");
      if (fs.existsSync(compFile) && fs.existsSync(defFile)) {
        return {
          componentCode: fs.readFileSync(compFile, "utf8"),
          definitions: fs.readFileSync(defFile, "utf8"),
        };
      }
    }
  } catch { /* */ }
  return null;
}

// Read source component code (component.jsx or index.jsx)
function readSourceComponent(sourceDir: string): { code: string; ext: string } | null {
  for (const name of ["component.jsx", "component.tsx", "index.jsx", "index.tsx"]) {
    const p = path.join(sourceDir, name);
    if (fs.existsSync(p)) {
      return { code: fs.readFileSync(p, "utf8"), ext: path.extname(name) };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { projectPath, componentName }: { projectPath: string; componentName: string } = await req.json();

  if (!projectPath?.trim() || !componentName?.trim()) {
    return NextResponse.json({ error: "projectPath and componentName are required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const builderPath = getBuilderPath(projectPath);
  const builderDir = path.join(builderPath, componentName);
  const sourceDir = path.join(getComponentsPath(projectPath), componentName);

  if (!fs.existsSync(sourceDir)) {
    return NextResponse.json({ error: `Source component not found at ${sourceDir}` }, { status: 400 });
  }

  const source = readSourceComponent(sourceDir);
  if (!source) return NextResponse.json({ error: "No component file found in source directory" }, { status: 400 });

  const example = getBuilderExample(builderPath);
  const isDynamic = usesDynamicPattern(builderPath);

  // Read definitions.generic.mjs so Claude can reuse d.propName for common props
  const genericDefsPath = path.join(builderPath, "definitions.generic.mjs");
  const genericDefs = fs.existsSync(genericDefsPath)
    ? fs.readFileSync(genericDefsPath, "utf8")
    : null;

  const genericSection = genericDefs
    ? `This project has a shared definitions.generic.mjs with reusable props:

\`\`\`js
${genericDefs}
\`\`\`

When a prop in the component matches one defined in definitions.generic.mjs, reuse it as \`d.propName\` instead of redefining it explicitly. Only write explicit prop objects for props that are NOT covered by the generic file.
Always add \`import d from "../definitions.generic.mjs";\` at the top of the definitions file when using any \`d.\` props.`
    : "";

  const exampleSection = example
    ? `Here is an existing page builder component from this project as a reference:

REFERENCE component.jsx:
\`\`\`jsx
${example.componentCode}
\`\`\`

REFERENCE definitions.sourceflow.mjs:
\`\`\`js
${example.definitions}
\`\`\`

Follow the same patterns, coding style, and prop conventions shown above.`
    : "";

  const prompt = `You are converting a Sourceflow component into a page builder component.

${genericSection}

${exampleSection}

Now convert this component:

SOURCE component (${componentName}):
\`\`\`jsx
${source.code}
\`\`\`

Rules:
1. Keep all styling, CSS classes, and JSX structure identical — do not change layout or design
2. Remove any EditableText, EditableImage, or other CMS inline-editing wrappers — replace with plain props directly
3. The component should accept plain props from the page builder CMS — no fetching, no hooks for data
4. Generate a definitions.sourceflow.mjs that maps every prop the component uses with correct types:
   - string for text fields
   - formatted_text for HTML/rich text
   - boolean for true/false toggles
   - image for image objects ({ src, alt })
   - template for arrays of items (with template_schema for sub-fields)
   - Include sensible defaultValues where obvious
5. Do NOT import from definitions.generic.mjs — write all props explicitly like the reference example

Respond with ONLY valid JSON in this exact format, no markdown, no explanation:
{"component":"<full component.jsx code>","definitions":"<full definitions.sourceflow.mjs code>"}`;

  try {
    fs.mkdirSync(builderDir, { recursive: true });

    const claudeRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();
    const raw = claudeData?.content?.[0]?.text?.trim();
    if (!raw) return NextResponse.json({ error: "No response from Claude" }, { status: 500 });

    let parsed: { component: string; definitions: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON if Claude added any surrounding text
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: "Could not parse Claude response" }, { status: 500 });
      parsed = JSON.parse(match[0]);
    }

    const ext = source.ext;

    // Write transformed component
    fs.writeFileSync(path.join(builderDir, `component${ext}`), parsed.component, "utf8");

    // Write definitions
    fs.writeFileSync(path.join(builderDir, "definitions.sourceflow.mjs"), parsed.definitions, "utf8");

    const generatedFiles: { name: string; content: string }[] = [
      { name: `component${ext}`, content: parsed.component },
      { name: "definitions.sourceflow.mjs", content: parsed.definitions },
    ];

    // Copy other files (styles etc.) from source and include text ones in response
    const TEXT_EXTS = /\.(css|scss|less|module\.css|module\.scss|svg|js|jsx|ts|tsx|json|txt|md)$/;
    const allFiles = fs.readdirSync(sourceDir, { withFileTypes: true }).filter((e) => e.isFile());
    for (const file of allFiles) {
      if (file.name.startsWith("index.") || file.name.startsWith("component.")) continue;
      fs.copyFileSync(path.join(sourceDir, file.name), path.join(builderDir, file.name));
      if (TEXT_EXTS.test(file.name)) {
        const content = fs.readFileSync(path.join(sourceDir, file.name), "utf8");
        generatedFiles.push({ name: file.name, content });
      }
    }

    // Create index.jsx dynamic wrapper if project uses that pattern
    const wrapper = `import dynamic from "next/dynamic";\n\nexport const ${componentName} = dynamic(() => import("./component"));\n`;
    if (isDynamic) {
      fs.writeFileSync(path.join(builderDir, `index${ext}`), wrapper, "utf8");
      generatedFiles.push({ name: `index${ext}`, content: wrapper });
    }

    // Add export to builder/index.js or builder/index.jsx
    const indexFile =
      fs.existsSync(path.join(builderPath, "index.jsx")) ? path.join(builderPath, "index.jsx") :
      fs.existsSync(path.join(builderPath, "index.js")) ? path.join(builderPath, "index.js") :
      null;

    if (indexFile) {
      const indexContent = fs.readFileSync(indexFile, "utf8");
      const exportLine = `export { ${componentName} } from "./${componentName}";`;
      if (!indexContent.includes(exportLine)) {
        fs.writeFileSync(indexFile, indexContent.trimEnd() + "\n" + exportLine + "\n", "utf8");
      }
    }

    return NextResponse.json({ success: true, files: generatedFiles });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
