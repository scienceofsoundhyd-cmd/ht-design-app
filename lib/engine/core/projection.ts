import { Scene, SceneObject } from "./types"

export type ProjectedObject = {
  id: string
  type: string
  x: number
  y: number
  width?: number
  height?: number
}

export type ProjectedScene = {
  objects: ProjectedObject[]
}

export function projectScene(scene: Scene, scale: number): ProjectedScene {
  const objects: ProjectedObject[] = scene.objects.map((obj: SceneObject) => {
    const base = { id: obj.id, type: obj.type, x: obj.x * scale, y: obj.y * scale }
    if (obj.type === "room" || obj.type === "screen") {
      return { ...base, width: obj.width * scale, height: obj.height * scale }
    }
    return base
  })
  return { objects }
}