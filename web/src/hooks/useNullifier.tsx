'use client'

import { secp256k1 } from '@noble/curves/secp256k1'
import { hasher, nullifierMessage, splitToRegisters } from 'common'
import { ReactNode, createContext, useContext, useState } from 'react'
import { Hex, hashMessage, hexToNumber, keccak256 } from 'viem'
import { useAccount, useSignMessage } from 'wagmi'

type INullifierContext = {
  signNullifierMessage: () => Promise<{ secret: bigint; nullifier: Hex }>
}
const NullifierContext = createContext<INullifierContext>(
  {} as INullifierContext
)

export const NullifierContextProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  const { signMessageAsync } = useSignMessage({
    message: nullifierMessage,
  })

  const signNullifierMessage = async () => {
    const nullifierMessageHashed = hashMessage(nullifierMessage!)
    const signature = await signMessageAsync()
    const v = hexToNumber(`0x${signature.slice(130)}`)
    const pub = secp256k1.Signature.fromCompact(signature.substring(2, 130))
      .addRecoveryBit(v - 27)
      .recoverPublicKey(nullifierMessageHashed.substring(2))
      .toHex(false)

    const publicKeyPoint = secp256k1.ProjectivePoint.fromHex(pub)
    const secret = BigInt(keccak256(signature))

    const Qa = [
      ...splitToRegisters(publicKeyPoint.toAffine().x),
      ...splitToRegisters(publicKeyPoint.toAffine().y),
    ]

    const nullifierHex = `0x${BigInt(await hasher([...Qa, secret])).toString(
      16
    )}` as Hex
    return { secret, nullifier: nullifierHex }
  }

  return (
    <NullifierContext.Provider
      value={{ signNullifierMessage }}
    >
      {children}
    </NullifierContext.Provider>
  )
}

export const useNullifierContext = () => useContext(NullifierContext)
