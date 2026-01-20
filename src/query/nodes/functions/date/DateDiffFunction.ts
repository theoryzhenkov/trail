/**
 * dateDiff(date1, date2, unit) - Get difference between dates
 */

import {FunctionNode, toString} from "../FunctionNode";
import type {Value, NodeDoc} from "../../types";

export class DateDiffFunction extends FunctionNode {
	static minArity = 3;
	static maxArity = 3;
	static documentation: NodeDoc = {
		title: "dateDiff",
		description: "Get difference between dates in specified unit (d, w, m, y, h, min).",
		syntax: "dateDiff(date1, date2, unit)",
		returnType: "number",
		examples: ['dateDiff(due, today, "d") < 7', 'dateDiff(created, now(), "m")'],
	};

	static evaluate(args: Value[]): Value {
		const date1 = args[0] ?? null;
		const date2 = args[1] ?? null;
		const unit = toString(args[2] ?? null);

		if (!(date1 instanceof Date) || !(date2 instanceof Date)) {
			return null;
		}

		const diffMs = date1.getTime() - date2.getTime();
		const msPerMinute = 60 * 1000;
		const msPerHour = 60 * msPerMinute;
		const msPerDay = 24 * msPerHour;
		const msPerWeek = 7 * msPerDay;
		const msPerMonth = 30 * msPerDay; // Approximate
		const msPerYear = 365 * msPerDay; // Approximate

		switch (unit.toLowerCase()) {
			case "min":
			case "minute":
			case "minutes":
				return Math.floor(diffMs / msPerMinute);
			case "h":
			case "hour":
			case "hours":
				return Math.floor(diffMs / msPerHour);
			case "d":
			case "day":
			case "days":
				return Math.floor(diffMs / msPerDay);
			case "w":
			case "week":
			case "weeks":
				return Math.floor(diffMs / msPerWeek);
			case "m":
			case "month":
			case "months":
				return Math.floor(diffMs / msPerMonth);
			case "y":
			case "year":
			case "years":
				return Math.floor(diffMs / msPerYear);
			default:
				return Math.floor(diffMs / msPerDay); // Default to days
		}
	}
}
