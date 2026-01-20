/**
 * Function Node Exports
 * 
 * Import this module to register all built-in functions.
 */

// Base
export {FunctionNode, registerFunc, toString} from "./FunctionNode";

// String functions
export * from "./string";

// File functions
export * from "./file";

// Array functions
export * from "./array";

// Existence functions
export * from "./existence";

// Date functions
export * from "./date";

// Property access
export {PropFunction} from "./PropFunction";

// Register all functions on import
import "./register";
