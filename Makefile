.DEFAULT_GOAL := help
SHELL := /bin/bash

# staging = testnet, production = mainnet
network ?= testnet
admin ?= stellar-members-$(network)
attester ?= stellar-members-attester-$(network)
wasm = contract/target/wasm32v1-none/release/stellar_membership.wasm
contract_id = $(shell cat .stellar/stellar_membership_id-$(network))
nqg_contract = CAM3VZX47TCQWCEYGXEDTSIJYKIVM6AWMFR7VTFYTETXFO53I5LOZGBT

help:  ## list the targets
	@grep -E '^[a-z_]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-24s %s\n", $$1, $$2}'

build:  ## build the contract WASM
	cd contract && stellar contract build --optimize

test:  ## contract tests
	cd contract && cargo test

lint:  ## clippy and rustfmt
	cd contract && cargo clippy --all-targets --all-features -- -Dwarnings && cargo fmt --check

bindings: build  ## regenerate the TypeScript bindings from the WASM
	stellar contract bindings typescript --wasm $(wasm) --output-dir packages/stellar-membership --overwrite && \
	rm packages/stellar-membership/README.md && \
	cd packages/stellar-membership && bun install && bun run build

deploy: build  ## deploy the contract with the admin and attester identities
	stellar contract deploy \
		--wasm $(wasm) \
		--source-account $(admin) \
		--network $(network) \
		--salt $(shell printf stellar-membership | openssl sha256 | cut -d " " -f2) \
		-- \
		--admin $(shell stellar keys address $(admin)) \
		--attester $(shell stellar keys address $(attester)) \
		--name "Stellar Members" --symbol SMBR \
		--uri https://ipfs.io/ipfs/QmVTqJ4EzJThVWobgyaWCetcrXCjftQhgi24E4giJ5EgXr \
		--uri_trait https://ipfs.io/ipfs/Qmddf2UgGTQ3z2SZfg2ziZJzDJDRS3Dk7Z3phZ76fMzdLf \
		--nqg_contract $(nqg_contract) \
		> .stellar/stellar_membership_id-$(network) && \
	cat .stellar/stellar_membership_id-$(network)

upgrade: build  ## upgrade the deployed contract in place
	stellar contract invoke \
		--source-account $(admin) \
		--network $(network) \
		--id $(contract_id) \
		-- \
		upgrade \
		--wasm_hash $(shell stellar contract upload --source-account $(admin) --network $(network) --wasm $(wasm))

invoke:  ## call a function as the admin: make invoke fn=member args="--token_id 0"
	stellar contract invoke \
		--source-account $(admin) \
		--network $(network) \
		--id $(contract_id) \
		-- \
		$(fn) $(args)

.PHONY: help build test lint bindings deploy upgrade invoke
