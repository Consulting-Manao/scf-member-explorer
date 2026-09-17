import { Link } from "@tanstack/react-router";
import {
  ExternalLinkIcon,
  LogOutIcon,
  RefreshCwIcon,
  UserRoundIcon,
  WalletIcon,
} from "lucide-react";

import { explorerUrl } from "@/lib/config";
import { notify } from "@/lib/toast";
import { shortAddress } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import { useMyMembership } from "@/queries/members";

import { MemberAvatar } from "./MemberAvatar";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function ConnectButton() {
  const { address, connect, disconnect } = useWallet();
  const { member } = useMyMembership();

  const onConnect = () =>
    connect().catch((error) => notify.failure("Not connected", error));

  if (!address) {
    return (
      <Button onClick={onConnect}>
        <WalletIcon />
        Connect
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 pl-1.5">
          {member ? (
            <MemberAvatar member={member} className="size-7 ring-0" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-muted">
              <WalletIcon className="size-3.5" />
            </span>
          )}
          <span className="font-mono text-xs">{shortAddress(address)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {member ? `Member #${member.tokenId}` : "Not a member yet"}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRoundIcon /> {member ? "My profile" : "Join"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={explorerUrl("account", address)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLinkIcon /> View account
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onConnect}>
          <RefreshCwIcon /> Switch account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => disconnect()}>
          <LogOutIcon /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
