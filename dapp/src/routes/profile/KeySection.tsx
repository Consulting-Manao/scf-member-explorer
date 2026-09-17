import { KeyHandover } from "@/components/KeyHandover";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { membershipClient, type MemberView } from "@/lib/contract";
import { useInvalidateMembers } from "@/queries/members";

export function KeySection({ member }: { member: MemberView }) {
  const invalidate = useInvalidateMembers();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your key</CardTitle>
        <CardDescription>
          Move your membership to another Stellar account. Same member, same
          history, new key.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <KeyHandover
          actionLabel="Rotate"
          adoptNewKey
          build={(newAddress) =>
            membershipClient(newAddress).rotate_key({
              token_id: member.tokenId,
              new_address: newAddress,
            })
          }
          onDone={async () => {
            await invalidate([member.tokenId]);
            window.scrollTo({ top: 0 });
          }}
        />
      </CardContent>
    </Card>
  );
}
