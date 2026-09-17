.DEFAULT_GOAL := help
SHELL := /bin/bash

# staging = testnet, production = mainnet
network ?= testnet
admin ?= stellar-members-$(network)
attester ?= stellar-members-attester-$(network)
wasm = target/wasm32v1-none/release/stellar_membership.wasm
contract_id = $(shell cat contracts/deployments/stellar-membership-$(network))
nqg_contract = CAM3VZX47TCQWCEYGXEDTSIJYKIVM6AWMFR7VTFYTETXFO53I5LOZGBT

help:  ## list the targets
	@grep -E '^[a-z_]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-24s %s\n", $$1, $$2}'

build:  ## build the contract WASM
	stellar contract build --optimize

test:  ## contract tests
	cargo test

lint:  ## clippy and rustfmt
	cargo clippy --all-targets --all-features -- -Dwarnings && cargo fmt --check

bindings: build  ## regenerate the TypeScript bindings from the WASM
	stellar contract bindings typescript --wasm $(wasm) --output-dir bindings --overwrite && \
	rm -f bindings/README.md && \
	cd bindings && bun install && bun run build

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
		> contracts/deployments/stellar-membership-$(network) && \
	cat contracts/deployments/stellar-membership-$(network)

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
