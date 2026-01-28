const RELATION_NAME_REGEX = /^[a-z0-9_-]+$/i;

export function normalizeRelationName(name: string): string {
	return name.trim();
}

export function isValidRelationName(value: string): boolean {
	if (value.length === 0) {
		return false;
	}
	return RELATION_NAME_REGEX.test(value);
}
