#!/usr/bin/env python3
"""CLI tool that summarizes client meeting notes using the Anthropic API.

Usage:
    python summarize.py notes.txt
    python summarize.py notes.txt --save
    cat notes.txt | python summarize.py
    python summarize.py   # then paste notes and press Ctrl+D
"""

import argparse
import os
import sys
from datetime import datetime

import anthropic

from prompts import SUMMARY_PROMPT

MODEL = "claude-sonnet-4-6"


def get_notes(input_path: str | None) -> str:
    if input_path:
        with open(input_path, "r", encoding="utf-8") as f:
            return f.read()
    return sys.stdin.read()


def summarize_notes(notes: str) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("Error: ANTHROPIC_API_KEY environment variable is not set.")

    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model=MODEL,
        max_tokens=2048,
        messages=[
            {"role": "user", "content": SUMMARY_PROMPT.format(notes=notes)}
        ],
    )

    return message.content[0].text


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Summarize client meeting notes using Claude."
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        help="Path to a .txt file with meeting notes. If omitted, reads from stdin.",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save the output to a markdown file in addition to printing it.",
    )
    args = parser.parse_args()

    if args.input_file is None and sys.stdin.isatty():
        print("Paste your meeting notes below, then press Ctrl+D (Ctrl+Z on Windows) when done:\n")

    notes = get_notes(args.input_file)
    if not notes.strip():
        sys.exit("Error: no meeting notes provided.")

    result = summarize_notes(notes)

    print("\n" + "=" * 60)
    print(result)
    print("=" * 60)

    if args.save:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"meeting_summary_{timestamp}.md"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"\nSaved output to {output_path}")


if __name__ == "__main__":
    main()
