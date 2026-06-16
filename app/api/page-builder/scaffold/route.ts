import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TEMPLATES: Record<string, string> = {
  "hooks/useDynamicPage.js": `import useDynamicPages from "@/hooks/useDynamicPages";

export const useDynamicPage = (url_slug) => useDynamicPages().find((i) => i.url_slug === url_slug);

export default useDynamicPage;
`,

  "hooks/useDynamicPages.js": `import data from "@/.sourceflow/dynamic_pages.json";

export const useDynamicPages = () => data;

export default useDynamicPages;
`,

  "hooks/useGlobal.js": `import BaseObject from "@sourceflow-uk/sourceflow-sdk/base_object";
import data from "@/.sourceflow/global.json";

export const useGlobal = () => new BaseObject(data, "en").toJson();

export default useGlobal;
`,

  "hooks/useIsPreview.js": `export const useIsPreview = () => {
  if (typeof window !== "undefined") {
    return window.top !== window;
  }

  return false;
};
`,

  "hooks/useSourceFlowCollection.js": `import BaseCollection from "@sourceflow-uk/sourceflow-sdk/base_collection";

export default function useSourceFlowCollection(data, mappings = null) {
  let collection = new BaseCollection(data, "en").getItems();

  if (!mappings) {
    return collection;
  }

  const keys = Object.keys(mappings);

  return collection.map((item) => {
    keys.forEach((key) => {
      if (key in item && item[key] !== null) {
        const collection = new BaseCollection(mappings[key], "en").getItems();

        item[\`__\${key}\`] = item[key];
        item[key] = Array.isArray(item[key])
          ? collection.filter((m) => item[key].includes(m.id))
          : (collection.find((m) => item[key].includes(m.id)) ?? null);
      }
    });

    return item;
  });
}
`,

  "ui/AnimateIn/index.jsx": `import dynamic from "next/dynamic";

export const AnimateIn = dynamic(() => import("./component"));
`,

  "ui/AnimateIn/component.jsx": `import AOS from "aos";
import "aos/dist/aos.css";
import { useEffect } from "react";

export default function ({
  className = "",
  children,
  animation = "zoom-out-up",
  delay = 250,
  duration = 500,
  once = true,
  easing = "ease-in-sine",
  ...props
}) {
  useEffect(() => {
    AOS.init({ disable: () => window.innerWidth < 992 });
  }, []);

  return (
    <div
      className={className}
      data-aos={animation}
      data-aos-delay={delay}
      data-aos-duration={duration}
      data-aos-once={once}
      data-aos-easing={easing}
      {...props}
    >
      {children}
    </div>
  );
}
`,

  "ui/ContentBlocks/index.jsx": `import dynamic from "next/dynamic";

export const ContentBlocks = dynamic(() => import("./component"));
`,

  "ui/ContentBlocks/component.jsx": `import * as components from "@/builder";
import useGlobal from "@/hooks/useGlobal";
import { useIsPreview } from "@/hooks/useIsPreview";
import { AnimateIn } from "@/ui/AnimateIn";
import SourceFlowContent from "@sourceflow-uk/sourceflow-content";
import imagesMetaData from "@/.sourceflow/image_metadata.json";

export default function ({ data, prefix = null, additionalComponents = {} }) {
  const global = useGlobal();
  const isPreview = useIsPreview();

  return (
    <SourceFlowContent
      global={global}
      imagesMetaData={imagesMetaData}
      prefix={prefix}
      data={(data ?? []).map((i) =>
        "name" in i && !("component" in i) ? { ...i, component: i.name } : i,
      )}
      components={{ ...components, ...additionalComponents }}
      ContainerComponent={isPreview ? ({ children }) => <div>{children}</div> : AnimateIn}
    />
  );
}
`,

  "ui/DynamicPageSeo/index.jsx": `import dynamic from "next/dynamic";

export const DynamicPageSeo = dynamic(() => import("./component"));
`,

  "builder/index.js": `export { Content } from "./Content";
`,

  "builder/definitions.generic.mjs": `const className = {
  name: "className",
  type: "string",
  defaultValue: "",
};

const title = {
  name: "title",
  label: "Title",
  type: "string",
  defaultValue: "Title goes here...",
};

const subtitle = {
  name: "subtitle",
  label: "Subtitle",
  type: "string",
  defaultValue: "Subtitle goes here...",
};

const text = {
  name: "text",
  label: "Text",
  type: "string",
  defaultValue: "Text goes here...",
};

const image = {
  name: "image",
  label: "Image",
  type: "file",
  defaultValue: "",
};

const form = {
  name: "form",
  label: "Form",
  type: "forms",
  defaultValue: "",
};

const content = {
  name: "content",
  label: "Content",
  type: "formatted_text",
  defaultValue: "Content goes here...",
};

const reverse = {
  name: "reverse",
  label: "Reverse",
  type: "boolean",
  defaultValue: false,
};

export default {
  className,
  title,
  subtitle,
  text,
  image,
  form,
  content,
  reverse,
};
`,

  "builder/Content/index.jsx": `import { Container } from "reactstrap";
import cn from 'classnames';
import styles from './styles.module.scss';

export const Content = ({
    className,
    title,
    content
}) => {

    return (
        <section className={cn(styles.Content, className)}>
            <Container className='py-5'>
                {title && (
                    <h2 className={cn(styles.title)}>
                        {title}
                    </h2>
                )}
                <div className={cn(styles.desc)} dangerouslySetInnerHTML={{ __html: content }} />
            </Container>
        </section>
    );

}

export default Content;
`,

  "builder/Content/definitions.sourceflow.mjs": `import d from "../definitions.generic.mjs";

export default {
  component: "Content",
  label: "Content",
  propSchema: [
    d.title,
    d.content,
    d.className,
  ],
};
`,

  "builder/Content/styles.module.scss": `@use "@/styles/variables" as *;
@use "@/styles/mixins" as mix;

.Content {

}
`,

  "pages/components.js": `import { ContentBlocks } from "@/ui/ContentBlocks";
import { useEffect, useState } from "react";

export default function ComponentsPage() {
  const [content, setContent] = useState([]);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (!event.data) return;
      switch (event.data.type) {
        case "SET_CONTENT":
          const parsed = JSON.parse(event.data.message);
          setContent(parsed);
          break;
      }
    });
  }, []);

  if (!content.length)
    return (
      <div className="w-100 h-100 d-flex justify-content-center align-items-center p-5">
        <p className="m-5">No components are passed in.</p>
      </div>
    );

  return (
    <div>
      <ContentBlocks data={content} />
    </div>
  );
}
`,

  "ui/DynamicPageSeo/component.jsx": `import SourceFlowHead from "@sourceflow-uk/sourceflow-head";
import metaObject from "@/.sourceflow/metadata.json";
import { useMemo } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME;
const SITE_DESCRIPTION = process.env.NEXT_PUBLIC_SITE_DESCRIPTION;
const TWITTER_HANDLE = process.env.NEXT_PUBLIC_TWITTER_HANDLE;
const NEXT_PUBLIC_LOGO = process.env.NEXT_PUBLIC_LOGO;

export const defaultProps = {
  metaObject,
  siteName: SITE_NAME,
  title: SITE_NAME,
  titleTemplate: \`%s | \${SITE_NAME}\`,
  defaultTitle: SITE_NAME,
  description: SITE_DESCRIPTION,
  images: [{ url: NEXT_PUBLIC_LOGO }],
  twitter: {
    site: TWITTER_HANDLE,
    cardType: "summary_large_image",
  },
};

export default function ({
  title,
  robots,
  keywords,
  alternate = { url: "", hreflang: "" },
  canonical: __canonical = "",
  description,
  json_schema,
}) {
  const canonical = useMemo(() => {
    let url = __canonical.startsWith("http") ? __canonical : \`\${BASE_URL}\${__canonical}\`;
    return !url.endsWith("/") ? \`\${url}/\` : url;
  }, [__canonical]);

  const languageAlternates = useMemo(() => {
    if (alternate?.hreflang && alternate?.hreflang) {
      return [{ hrefLang: alternate.hreflang, href: alternate.url }];
    }
    return [];
  }, []);

  return (
    <>
      <SourceFlowHead
        {...defaultProps}
        title={title.length > 0 ? title : SITE_NAME}
        description={description.length > 0 ? description : SITE_DESCRIPTION}
        canonical={canonical}
        robots={robots}
        keywords={keywords}
        languageAlternates={languageAlternates}
      />
      {json_schema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json_schema }} />
      )}
    </>
  );
}
`,
};

export async function POST(req: NextRequest) {
  const { projectPath, files }: { projectPath: string; files: string[] } = await req.json();

  if (!projectPath?.trim() || !files?.length) {
    return NextResponse.json({ error: "projectPath and files are required" }, { status: 400 });
  }

  const results: { key: string; success: boolean; error?: string }[] = [];

  for (const key of files) {
    const template = TEMPLATES[key];
    if (!template) {
      results.push({ key, success: false, error: "No template found" });
      continue;
    }

    try {
      const dest = path.join(projectPath, key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, template, "utf8");
      results.push({ key, success: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ key, success: false, error: msg });
    }
  }

  const allOk = results.every((r) => r.success);
  return NextResponse.json({ success: allOk, results });
}
