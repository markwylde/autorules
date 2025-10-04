import type { ThreadOptions } from "@markwylde/ailib";

type ModelOptions = NonNullable<ThreadOptions["modelOptions"]>;

type ProviderConfig = NonNullable<ModelOptions["provider"]>;
export const VALID_PROVIDER_SORTS: readonly ProviderConfig["sort"][] = [
	"price",
	"throughput",
];

export type ProviderSortOption = (typeof VALID_PROVIDER_SORTS)[number];

export function buildModelOptions(
	providerOnly?: string,
	providerSort?: ProviderSortOption,
): Pick<ModelOptions, "provider"> | undefined {
	const provider: ProviderConfig = {};

	if (providerOnly) {
		provider.only = [providerOnly];
	}

	if (providerSort) {
		provider.sort = providerSort;
	}

	if (!provider.only && !provider.sort) {
		return undefined;
	}

	return { provider };
}
