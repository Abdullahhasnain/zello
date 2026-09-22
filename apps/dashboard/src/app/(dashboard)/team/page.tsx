import { getMyProfile, listTeam } from "@/lib/api/users";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

const ROLE_TONE = {
  owner: "accent",
  staff: "neutral",
  viewer: "neutral",
} as const;

export default async function TeamPage() {
  const me = await getMyProfile();
  const team = me.role === "owner" ? await listTeam() : null;

  return (
    <div>
      <PageHeader title="Team" description="Everyone with access to your Zello AI dashboard." />

      {team === null ? (
        <EmptyState
          title="Owner access required"
          description="Ask your store owner to grant you access if you need to manage the team."
        />
      ) : (
        <TableWrap>
          <Table>
            <Thead>
              <Tr>
                <Th>Email</Th>
                <Th>Role</Th>
              </Tr>
            </Thead>
            <Tbody>
              {team.map((member) => (
                <Tr key={member.id}>
                  <Td className="font-medium">
                    {member.email}
                    {member.id === me.id ? (
                      <span className="ml-2 text-xs text-ink-faint">(you)</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
