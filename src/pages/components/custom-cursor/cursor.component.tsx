"use client"; // indicates Client Component

// Import with next's dynamic import
import dynamic from "next/dynamic";

const AnimatedCursor = dynamic(() => import("react-animated-cursor"), {
  ssr: false,
});

export const Cursor = () => {
  return (
    <AnimatedCursor
      innerSize={10}
      outerSize={35}
      color={"5, 184, 255"}
      outerAlpha={0.1}
      innerScale={0.7}
      outerScale={2}
      trailingSpeed={8}
      outerStyle={{
        border: "1px solid rgba(5, 184, 255, 0.5)",
      }}
      clickables={[
        "a",
        'input[type="text"]',
        'input[type="email"]',
        'input[type="number"]',
        'input[type="submit"]',
        'input[type="image"]',
        "label[for]",
        "select",
        "textarea",
        "button",
        ".link",
        "h2",
        {
          target: ".custom",
        },
      ]}
    />
  );
};
