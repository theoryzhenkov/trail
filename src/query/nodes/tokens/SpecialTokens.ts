/**
 * Special Tokens (EOF, String, Number, Duration, DateLiteral, Identifier)
 * 
 * These tokens don't have fixed keywords but are produced by the lexer
 * based on patterns in the input.
 */

import {TokenNode} from "../base/TokenNode";

/**
 * End of File token
 */
export class EOFToken extends TokenNode {
	static highlighting = undefined;
}

/**
 * String literal token
 */
export class StringToken extends TokenNode {
	static highlighting = "string" as const;
}

/**
 * Number literal token
 */
export class NumberToken extends TokenNode {
	static highlighting = "number" as const;
}

/**
 * Boolean literal token (value is "true" or "false")
 */
export class BooleanToken extends TokenNode {
	static highlighting = "atom" as const;
}

/**
 * Duration literal token (e.g., "7d", "1w", "2m", "1y")
 */
export class DurationToken extends TokenNode {
	static highlighting = "number" as const;
}

/**
 * Date literal token (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
 */
export class DateLiteralToken extends TokenNode {
	static highlighting = "number" as const;
}

/**
 * Identifier token (variable names, property names, relation names)
 */
export class IdentifierToken extends TokenNode {
	static highlighting = "variable" as const;
}
