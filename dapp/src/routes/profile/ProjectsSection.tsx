import { useState } from "react";

import { ProjectPicker } from "@/components/ProjectPicker";
import { TxProgress } from "@/components/TxProgress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTxAction } from "@/hooks/useTxAction";
import { membershipClient, type MemberView } from "@/lib/contract";

export function ProjectsSection({
  member,
  address,
}: {
  member: MemberView;
  address: string;
}) {
  const { step, busy, run } = useTxAction();
  const [projects, setProjects] = useState(member.projects);
  const changed = projects.join() !== member.projects.join();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your projects</CardTitle>
        <CardDescription>
          The Stellar projects you build or maintain, from PG Atlas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProjectPicker value={projects} onChange={setProjects} />
        {step && <TxProgress steps={["sign", "submit"]} current={step} />}
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          disabled={!changed || busy}
          onClick={() =>
            run(
              () =>
                membershipClient(address).set_projects({
                  caller: address,
                  token_id: member.tokenId,
                  projects,
                }),
              {
                touched: [member.tokenId],
                done: "Projects updated",
                failed: "Projects not updated",
              },
            )
          }
        >
          Save projects
        </Button>
      </CardFooter>
    </Card>
  );
}
