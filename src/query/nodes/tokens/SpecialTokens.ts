/**
 * Special Tokens (EOF, String, Number, Duration, DateLiteral, Identifier)
 * 
 * These tokens don't have fixed keywords but are produced by the lexer
 * based on patterns in the input.
 */

import {TokenNode} from "../base/TokenNode";
import {register} from "../registry";

/**
 * End of File token
 */
@register("EOF")
export class EOFToken extends TokenNode {
	static highlighting = undefined;
}

/**
 * String literal token
 */
@register("String")
export class StringToken extends TokenNode {
	static highlighting = "string" as const;
}

/**
 * Number literal token
 */
@register("Number")
export class NumberToken extends TokenNode {
	static highlighting = "number" as const;
}

/**
 * Boolean literal token (value is "true" or "false")
 */
@register("Boolean")
export class BooleanToken extends TokenNode {
	static highlighting = "atom" as const;
}

/**
 * Duration literal token (e.g., "7d", "1w", "2m", "1y")
 */
@register("Duration")
export class DurationToken extends TokenNode {
	static highlighting = "number" as const;
}

/**
 * Date literal token (ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
 */
@register("DateLiteral")
export class DateLiteralToken extends TokenNode {
	static highlighting = "number" as const;
}

/**
 * Identifier token (variable names, property names, relation names)
 */
@register("Identifier")
export class IdentifierToken extends TokenNode {
	static highlighting = "variable" as const;
}
