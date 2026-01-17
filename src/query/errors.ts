/**
 * TQL Error Classes
 */

import type {Span} from "./tokens";

/**
 * Base class for all TQL errors
 */
export abstract class TQLError extends Error {
	constructor(
		message: string,
		public span?: Span
	) {
		super(message);
		this.name = this.constructor.name;
	}

	/**
	 * Format error with source context
	 */
	format(source: string): string {
		if (!this.span) {
			return this.message;
		}

		const lines = source.split("\n");
		let currentPos = 0;
		let lineNum = 0;
		let colNum = 0;

		// Find line and column
		for (let i = 0; i < lines.length; i++) {
			const currentLine = lines[i] ?? "";
			const lineLength = currentLine.length + 1; // +1 for newline
			if (currentPos + lineLength > this.span.start) {
				lineNum = i + 1;
				colNum = this.span.start - currentPos + 1;
				break;
			}
			currentPos += lineLength;
		}

		const line = lines[lineNum - 1] ?? "";
		const pointer = " ".repeat(colNum - 1) + "^".repeat(Math.max(1, this.span.end - this.span.start));

		return `${this.message} at line ${lineNum}, column ${colNum}\n\n  ${line}\n  ${pointer}`;
	}
}

/**
 * Error during lexing/parsing phase
 */
export class ParseError extends TQLError {
	constructor(
		message: string,
		span: Span,
		public expected?: string[]
	) {
		super(message, span);
	}
}

/**
 * Validation error codes
 */
export type ValidationErrorCode =
	| "UNKNOWN_RELATION"
	| "UNKNOWN_GROUP"
	| "UNKNOWN_FUNCTION"
	| "INVALID_ARITY"
	| "CIRCULAR_REFERENCE"
	| "TYPE_MISMATCH"
	| "INVALID_RANGE_TYPE";

/**
 * Error during validation phase
 */
export class ValidationError extends TQLError {
	constructor(
		message: string,
		span: Span,
		public code: ValidationErrorCode
	) {
		super(message, span);
	}
}

/**
 * Error during query execution
 */
export class RuntimeError extends TQLError {
	constructor(message: string, span?: Span) {
		super(message, span);
	}
}

/**
 * Collection of validation errors
 */
export class ValidationErrors extends Error {
	constructor(public errors: ValidationError[]) {
		super(`Validation failed with ${errors.length} error(s)`);
		this.name = "ValidationErrors";
	}

	format(source: string): string {
		return this.errors.map((e) => e.format(source)).join("\n\n");
	}
}
