"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useInterval } from "react-simplikit";

const ROTATE_INTERVAL = 2400;
const EASE: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * Korean attaches 은 after a final consonant and 는 after a vowel, so the
 * particle is derived from the word instead of being written beside it.
 */
function topicParticle(word: string) {
  const last = word.trim().at(-1);
  const code = last == null ? -1 : last.charCodeAt(0);

  if (code < 0xac00 || code > 0xd7a3) {
    return "은";
  }

  return (code - 0xac00) % 28 === 0 ? "는" : "은";
}

export interface RollingWordProps {
  words: readonly [string, ...string[]];
}

/**
 * The visible phrase rolls up out of the line while the next one rises into it,
 * and the wrapper animates to the measured width of the incoming phrase so the
 * rest of the sentence slides instead of jumping.
 */
export function RollingWord({ words }: RollingWordProps) {
  const [index, setIndex] = useState(0);
  const [widths, setWidths] = useState<readonly number[]>([]);
  const sizers = useRef<Array<HTMLSpanElement | null>>([]);
  const reduceMotion = useReducedMotion();

  useInterval(() => setIndex((previous) => (previous + 1) % words.length), {
    delay: ROTATE_INTERVAL,
    enabled: words.length > 1,
  });

  useEffect(() => {
    const measure = () =>
      setWidths(sizers.current.map((sizer) => sizer?.getBoundingClientRect().width ?? 0));

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);

    for (const sizer of sizers.current) {
      if (sizer != null) {
        observer.observe(sizer);
      }
    }

    return () => observer.disconnect();
  }, [words]);

  const word = words[index] ?? words[0];
  const width = widths[index];
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.55, ease: EASE };

  return (
    <motion.span
      animate={width == null || width === 0 ? undefined : { width }}
      className="text-fg-brand relative inline-block overflow-hidden align-bottom"
      initial={false}
      transition={transition}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          className="inline-block whitespace-nowrap"
          exit={{ y: "-110%", opacity: 0, filter: "blur(12px)" }}
          initial={{ y: "110%", opacity: 0, filter: "blur(12px)" }}
          key={word}
          transition={transition}
        >
          {word}
          {topicParticle(word)}
        </motion.span>
      </AnimatePresence>

      <span
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex whitespace-nowrap"
      >
        {words.map((candidate, candidateIndex) => (
          <span
            key={candidate}
            ref={(node) => {
              sizers.current[candidateIndex] = node;
            }}
          >
            {candidate}
            {topicParticle(candidate)}
          </span>
        ))}
      </span>
    </motion.span>
  );
}
