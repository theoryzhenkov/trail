/**
 * Function Registration Module
 * 
 * Import this module to register all built-in functions.
 */

import {registerFunc} from "./FunctionNode";

// String functions
import {ContainsFunction} from "./string/ContainsFunction";
import {StartsWithFunction} from "./string/StartsWithFunction";
import {EndsWithFunction} from "./string/EndsWithFunction";
import {LengthFunction} from "./string/LengthFunction";
import {LowerFunction} from "./string/LowerFunction";
import {UpperFunction} from "./string/UpperFunction";
import {TrimFunction} from "./string/TrimFunction";
import {SplitFunction} from "./string/SplitFunction";
import {MatchesFunction} from "./string/MatchesFunction";

// File functions
import {InFolderFunction} from "./file/InFolderFunction";
import {HasExtensionFunction} from "./file/HasExtensionFunction";
import {HasTagFunction} from "./file/HasTagFunction";
import {TagsFunction} from "./file/TagsFunction";
import {HasLinkFunction} from "./file/HasLinkFunction";
import {BacklinksFunction} from "./file/BacklinksFunction";
import {OutlinksFunction} from "./file/OutlinksFunction";

// Array functions
import {LenFunction} from "./array/LenFunction";
import {FirstFunction} from "./array/FirstFunction";
import {LastFunction} from "./array/LastFunction";
import {IsEmptyFunction} from "./array/IsEmptyFunction";

// Existence functions
import {ExistsFunction} from "./existence/ExistsFunction";
import {CoalesceFunction} from "./existence/CoalesceFunction";
import {IfNullFunction} from "./existence/IfNullFunction";

// Date functions
import {NowFunction} from "./date/NowFunction";
import {DateFunction} from "./date/DateFunction";
import {YearFunction} from "./date/YearFunction";
import {MonthFunction} from "./date/MonthFunction";
import {DayFunction} from "./date/DayFunction";
import {WeekdayFunction} from "./date/WeekdayFunction";
import {HoursFunction} from "./date/HoursFunction";
import {MinutesFunction} from "./date/MinutesFunction";
import {FormatFunction} from "./date/FormatFunction";
import {DateDiffFunction} from "./date/DateDiffFunction";

// Property function
import {PropFunction} from "./PropFunction";

/**
 * Register all built-in functions
 */
export function registerAllFunctions(): void {
	// String functions
	registerFunc("contains", ContainsFunction);
	registerFunc("startsWith", StartsWithFunction);
	registerFunc("endsWith", EndsWithFunction);
	registerFunc("length", LengthFunction);
	registerFunc("lower", LowerFunction);
	registerFunc("upper", UpperFunction);
	registerFunc("trim", TrimFunction);
	registerFunc("split", SplitFunction);
	registerFunc("matches", MatchesFunction);

	// File functions
	registerFunc("inFolder", InFolderFunction);
	registerFunc("hasExtension", HasExtensionFunction);
	registerFunc("hasTag", HasTagFunction);
	registerFunc("tags", TagsFunction);
	registerFunc("hasLink", HasLinkFunction);
	registerFunc("backlinks", BacklinksFunction);
	registerFunc("outlinks", OutlinksFunction);

	// Array functions
	registerFunc("len", LenFunction);
	registerFunc("first", FirstFunction);
	registerFunc("last", LastFunction);
	registerFunc("isEmpty", IsEmptyFunction);

	// Existence functions
	registerFunc("exists", ExistsFunction);
	registerFunc("coalesce", CoalesceFunction);
	registerFunc("ifnull", IfNullFunction);

	// Date functions
	registerFunc("now", NowFunction);
	registerFunc("date", DateFunction);
	registerFunc("year", YearFunction);
	registerFunc("month", MonthFunction);
	registerFunc("day", DayFunction);
	registerFunc("weekday", WeekdayFunction);
	registerFunc("hours", HoursFunction);
	registerFunc("minutes", MinutesFunction);
	registerFunc("format", FormatFunction);
	registerFunc("dateDiff", DateDiffFunction);

	// Property function
	registerFunc("prop", PropFunction);
}

// Register all functions when this module is imported
registerAllFunctions();
