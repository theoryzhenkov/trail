export function createSectionDetails(
	containerEl: HTMLElement,
	detailsClass: string
): {
	details: HTMLDetailsElement;
	summary: HTMLElement;
	summaryContent: HTMLElement;
	content: HTMLElement;
} {
	const details = containerEl.createEl("details", {cls: detailsClass});
	const summary = details.createEl("summary", {cls: "trail-relation-summary"});
	const summaryContent = summary.createDiv({cls: "trail-relation-summary-content"});
	const content = details.createDiv({cls: "trail-relation-content"});

	return {details, summary, summaryContent, content};
}
