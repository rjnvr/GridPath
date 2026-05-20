"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js"

const MODEL_PATH = "/models/data-center.glb"

export function DataCenterScene() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return undefined
    const element: HTMLDivElement = container

    let disposed = false
    let animationFrame = 0
    let campusGroup: THREE.Group | null = null
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0f0f0f, 0.018)

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 4.6, 12.5)
    camera.lookAt(0, 0.15, 0)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    element.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 1.6)
    scene.add(ambient)

    const keyLight = new THREE.DirectionalLight(0x8fd7ff, 2.8)
    keyLight.position.set(4, 7, 6)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x3ab87a, 1.5)
    fillLight.position.set(-5, 3, 2)
    scene.add(fillLight)

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(3.7, 4.5, 0.18, 72),
      new THREE.MeshStandardMaterial({
        color: 0x161616,
        metalness: 0.2,
        roughness: 0.72
      })
    )
    pad.position.y = -1.85
    pad.scale.z = 0.58
    scene.add(pad)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.8, 0.012, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x3ab87a, transparent: true, opacity: 0.55 })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = -1.72
    ring.scale.y = 0.58
    scene.add(ring)

    function resize() {
      const { width, height } = element.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(element)
    resize()

    function frame(time: number) {
      if (campusGroup && !reducedMotion.matches) {
        campusGroup.rotation.y = Math.sin(time * 0.00035) * 0.16
        ring.rotation.z = time * 0.00012
      }

      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(frame)
    }

    new GLTFLoader().load(
      MODEL_PATH,
      (gltf: GLTF) => {
        if (disposed) return

        const model = gltf.scene
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = false
            child.receiveShadow = true
            child.material = normalizeMaterial(child.material)
          }
        })

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const scale = 3.35 / Math.max(size.x, size.y, size.z)

        model.position.sub(center)
        campusGroup = new THREE.Group()
        campusGroup.add(model)
        campusGroup.scale.setScalar(scale)
        campusGroup.rotation.set(-0.35, -0.62, 0)
        campusGroup.position.set(0.2, -0.3, 0)

        scene.add(campusGroup)
        setLoadError(false)
      },
      undefined,
      () => {
        if (!disposed) setLoadError(true)
      }
    )

    animationFrame = window.requestAnimationFrame(frame)

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      renderer.dispose()
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          disposeMaterial(object.material)
        }
      })
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="h-full w-full" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-12 bottom-8 h-16 bg-primary/10 blur-3xl"
      />
      {loadError ? (
        <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 rounded-md border border-border bg-background/85 px-3 py-2 text-center text-xs text-muted-foreground backdrop-blur">
          Data-center model unavailable
        </div>
      ) : null}
    </div>
  )
}

function normalizeMaterial(material: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((entry) => normalizeMaterial(entry)) as THREE.Material[]
  }

  material.side = THREE.DoubleSide
  material.needsUpdate = true

  if (material instanceof THREE.MeshStandardMaterial) {
    material.color.lerp(new THREE.Color(0xffffff), 0.12)
    material.emissive = material.color.clone().multiplyScalar(0.1)
    material.envMapIntensity = 0.8
    material.roughness = Math.max(material.roughness, 0.45)
    material.metalness = Math.min(material.metalness + 0.08, 0.7)
    return material
  }

  return material
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial)
    return
  }

  material.dispose()
}
