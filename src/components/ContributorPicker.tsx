"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import {
  contributorName,
  type Author,
  type ContributorNameLanguage,
} from "@/lib/data";

type Option = Pick<Author, "id" | "name" | "nameMalayalam">;
type Props = {
  label: string;
  options: Option[];
  language: ContributorNameLanguage;
  disabled: boolean;
} & (
  | { multiple: true; values: string[]; onChange: (values: string[]) => void }
  | { multiple?: false; value: string; onChange: (value: string) => void }
);

export default function ContributorPicker(props: Props) {
  const { label, options, language, disabled } = props;
  const id = useId();
  const control = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const activeOption = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [position, setPosition] = useState<CSSProperties>();
  const expanded = open && !disabled;
  const selectedIds = new Set(props.multiple ? props.values : [props.value]);
  const selected = options.filter(({ id }) => selectedIds.has(id));
  const selectionText =
    selected.length > 1
      ? `${selected.length} selected`
      : selected[0]
        ? contributorName(selected[0], language)
        : "";
  const choices = props.multiple
    ? options
    : [{ id: "", name: "No contributor" }, ...options];
  const search = query.trim().normalize().toLowerCase();
  const filtered = choices
    .filter(({ name, nameMalayalam }) =>
      [name, nameMalayalam].some((value) =>
        value?.normalize().toLowerCase().includes(search),
      ),
    )
    .sort(
      (first, second) =>
        Number(selectedIds.has(second.id)) - Number(selectedIds.has(first.id)),
    );
  const optionIndex = filtered.findIndex((option) => option.id === activeId);
  const listId = `${id}-options`;
  const optionId = (index: number) => `${listId}-${index}`;

  useLayoutEffect(() => {
    if (!expanded) return;
    const anchor = control.current;
    if (!anchor) return;
    const workspace = anchor.closest(".workspace");
    const positionList = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const bounds = workspace?.getBoundingClientRect();
      const visualTop = viewport?.offsetTop ?? 0;
      const viewportTop = Math.max(visualTop, bounds?.top ?? 0);
      const viewportBottom = Math.min(
        visualTop + (viewport?.height ?? window.innerHeight),
        bounds?.bottom ?? window.innerHeight,
      );
      const below = viewportBottom - rect.bottom;
      const above = rect.top - viewportTop;
      const opensAbove = below < 240 && above > below;
      setPosition({
        left: rect.left,
        width: rect.width,
        top: opensAbove ? undefined : rect.bottom + 4,
        bottom: opensAbove ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: Math.min(240, Math.max(0, (opensAbove ? above : below) - 8)),
        visibility:
          rect.bottom <= viewportTop || rect.top >= viewportBottom
            ? "hidden"
            : undefined,
      });
    };
    positionList();
    workspace?.addEventListener("scroll", positionList);
    window.addEventListener("resize", positionList);
    window.visualViewport?.addEventListener("resize", positionList);
    window.visualViewport?.addEventListener("scroll", positionList);
    return () => {
      workspace?.removeEventListener("scroll", positionList);
      window.removeEventListener("resize", positionList);
      window.visualViewport?.removeEventListener("resize", positionList);
      window.visualViewport?.removeEventListener("scroll", positionList);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    if (!expanded && input.current === document.activeElement)
      input.current?.select();
  }, [expanded]);

  useEffect(() => {
    activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [optionIndex]);

  function close() {
    setOpen(false);
    setQuery("");
    setActiveId(null);
  }

  function choose(value: string) {
    if (props.multiple) {
      props.onChange(
        props.values.includes(value)
          ? props.values.filter((item) => item !== value)
          : [...props.values, value],
      );
    } else {
      props.onChange(value);
      close();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const index = event.key === "ArrowDown"
        ? Math.min(optionIndex + 1, filtered.length - 1)
        : optionIndex < 0
          ? filtered.length - 1
          : Math.max(0, optionIndex - 1);
      setActiveId(filtered[index]?.id ?? null);
    } else if (expanded && event.key === "Enter" && optionIndex >= 0) {
      event.preventDefault();
      choose(filtered[optionIndex].id);
    } else if (expanded && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className="contributor-picker">
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <div className="contributor-picker-control" ref={control}>
        <input
          ref={input}
          id={id}
          className="field"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded && position ? listId : undefined}
          aria-activedescendant={
            expanded && position && optionIndex >= 0
              ? optionId(optionIndex)
              : undefined
          }
          autoComplete="off"
          placeholder={
            expanded
              ? "Search contributors"
              : props.multiple
                ? "Select contributors"
                : "No contributor"
          }
          value={expanded ? query : selectionText}
          disabled={disabled}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onBlur={close}
          onKeyDown={onKeyDown}
          onChange={(event) => {
            setOpen(true);
            setQuery(event.target.value);
            setActiveId(null);
          }}
        />
        <button
          type="button"
          className="contributor-picker-toggle"
          aria-label={`${expanded ? "Hide" : "Show"} ${label.toLowerCase()} options`}
          aria-expanded={expanded}
          disabled={disabled}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            input.current?.focus();
            if (expanded) close();
            else setOpen(true);
          }}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {expanded && position &&
        createPortal(
          <div className="contributor-picker-dropdown" style={position}>
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={`${id}-label`}
              aria-multiselectable={props.multiple || undefined}
            >
              {filtered.map((option, index) => {
                const isSelected = selectedIds.has(option.id);
                const active = index === optionIndex;
                return (
                  <li
                    key={option.id}
                    id={optionId(index)}
                    ref={active ? activeOption : undefined}
                    role="option"
                    aria-selected={isSelected}
                    data-active={active || undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option.id)}
                  >
                    <span>{contributorName(option, language)}</span>
                    {isSelected && <Check size={15} aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
            {!filtered.length && <p className="muted" role="status">No contributors found</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}
