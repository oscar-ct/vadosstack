"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TextareaProps = React.ComponentProps<"textarea"> & {
  autoResize?: boolean
}

function resizeTextarea(element: HTMLTextAreaElement) {
  element.style.height = "auto"
  element.style.height = `${element.scrollHeight}px`
}

function Textarea({ autoResize = true, className, onInput, ref, ...props }: TextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

  React.useLayoutEffect(() => {
    if (!autoResize || !textareaRef.current) return

    resizeTextarea(textareaRef.current)
  }, [autoResize, props.value, props.defaultValue])

  return (
    <textarea
      ref={textareaRef}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      onInput={(event) => {
        if (autoResize) {
          resizeTextarea(event.currentTarget)
        }

        onInput?.(event)
      }}
      {...props}
    />
  )
}

export { Textarea }
