import { getMyTenant } from "@/lib/api/tenants";
import { PageHeader } from "@/components/ui/page-header";
import { WidgetStudioClient } from "@/components/widget-studio/widget-studio-client";

export default async function WidgetStudioPage() {
  const tenant = await getMyTenant();

  return (
    <div>
      <PageHeader
        title="Widget Studio"
        description="Customize how your AI agent looks and speaks, then embed it on your storefront."
      />
      <WidgetStudioClient tenant={tenant} />
    </div>
  );
}
