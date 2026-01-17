/**
 * Date Built-in Functions
 */

import type {Value} from "../ast";
import type {BuiltinFunction} from "./index";

/**
 * Convert value to Date
 */
function toDate(value: Value): Date | null {
	if (value === null) return null;
	if (value instanceof Date) return value;
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (!isNaN(parsed)) return new Date(parsed);
	}
	if (typeof value === "number") return new Date(value);
	return null;
}

export const dateFunctions: Record<string, BuiltinFunction> = {
	/**
	 * now() - Current date and time
	 */
	now: {
		minArity: 0,
		maxArity: 0,
		call: (): Value => {
			return new Date();
		},
	},

	/**
	 * date(value) - Parse string/number to date
	 */
	date: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const value = args[0] ?? null;
			if (value === null) return null;
			const parsed = toDate(value);
			return parsed;
		},
	},

	/**
	 * year(date) - Get year from date
	 */
	year: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const date = toDate(args[0] ?? null);
			if (!date) return null;
			return date.getFullYear();
		},
	},

	/**
	 * month(date) - Get month (1-12) from date
	 */
	month: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const date = toDate(args[0] ?? null);
			if (!date) return null;
			return date.getMonth() + 1;
		},
	},

	/**
	 * day(date) - Get day of month from date
	 */
	day: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const date = toDate(args[0] ?? null);
			if (!date) return null;
			return date.getDate();
		},
	},

	/**
	 * weekday(date) - Get day of week (0=Sunday, 6=Saturday)
	 */
	weekday: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const date = toDate(args[0] ?? null);
			if (!date) return null;
			return date.getDay();
		},
	},

	/**
	 * hours(date) - Get hours (0-23)
	 */
	hours: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const date = toDate(args[0] ?? null);
			if (!date) return null;
			return date.getHours();
		},
	},

	/**
	 * minutes(date) - Get minutes (0-59)
	 */
	minutes: {
		minArity: 1,
		maxArity: 1,
		call: (args: Value[]): Value => {
			const date = toDate(args[0] ?? null);
			if (!date) return null;
			return date.getMinutes();
		},
	},

	/**
	 * format(date, pattern) - Format date as string
	 * Supports: YYYY, MM, DD, HH, mm, ss
	 */
	format: {
		minArity: 2,
		maxArity: 2,
		call: (args: Value[]): Value => {
			const date = toDate(args[0] ?? null);
			if (!date) return null;

			const pattern = args[1];
			if (typeof pattern !== "string") return null;

			const pad = (n: number, len: number = 2) => String(n).padStart(len, "0");

			return pattern
				.replace(/YYYY/g, String(date.getFullYear()))
				.replace(/MM/g, pad(date.getMonth() + 1))
				.replace(/DD/g, pad(date.getDate()))
				.replace(/HH/g, pad(date.getHours()))
				.replace(/mm/g, pad(date.getMinutes()))
				.replace(/ss/g, pad(date.getSeconds()));
		},
	},

	/**
	 * dateDiff(date1, date2, unit?) - Difference between dates
	 * unit: "days" (default), "hours", "minutes", "seconds", "ms"
	 */
	dateDiff: {
		minArity: 2,
		maxArity: 3,
		call: (args: Value[]): Value => {
			const date1 = toDate(args[0] ?? null);
			const date2 = toDate(args[1] ?? null);
			if (!date1 || !date2) return null;

			const diffMs = date1.getTime() - date2.getTime();
			const unit = args[2] ?? "days";

			switch (unit) {
				case "ms":
					return diffMs;
				case "seconds":
					return Math.floor(diffMs / 1000);
				case "minutes":
					return Math.floor(diffMs / (1000 * 60));
				case "hours":
					return Math.floor(diffMs / (1000 * 60 * 60));
				case "days":
				default:
					return Math.floor(diffMs / (1000 * 60 * 60 * 24));
			}
		},
	},
};
