"use client"

import type { ComponentProps } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CAMERA_ANGLE_OPTIONS,
  MOVEMENT_OPTIONS,
  resolveCameraAngleValue,
  resolveMovementValue,
} from "@/lib/shot-options"

type ShotFieldSelectProps = {
  value: string
  onValueChange: (value: string) => void
  id?: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  triggerProps?: ComponentProps<typeof SelectTrigger>
}

export function ShotMovementSelect({
  value,
  onValueChange,
  id,
  disabled,
  triggerClassName,
  contentClassName,
  triggerProps,
}: ShotFieldSelectProps) {
  const resolvedValue = resolveMovementValue(value)

  return (
    <Select value={resolvedValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={triggerClassName} {...triggerProps}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {MOVEMENT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ShotCameraAngleSelect({
  value,
  onValueChange,
  id,
  disabled,
  triggerClassName,
  contentClassName,
  triggerProps,
}: ShotFieldSelectProps) {
  const resolvedValue = resolveCameraAngleValue(value)

  return (
    <Select value={resolvedValue} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={triggerClassName} {...triggerProps}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {CAMERA_ANGLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
