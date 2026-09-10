#!/usr/bin/env python3
import os
import sys
import subprocess
import json

project_dir = os.path.abspath(".ultraskills/storyboard-video/documentaries/shih-tzu-puppies")
script_path = os.path.abspath(".agents/skills/storyboard-video/scripts/synthesize_voiceover.py")

scenes = [
    {
        "id": "scene_01_hook",
        "text": "Você já viu algo mais adorável do que um filhotinho de Shih Tzu tropeçando nas próprias patinhas? Prepare o seu coração, porque hoje vamos conhecer o mundo das criaturinhas mais fofas do planeta!"
    },
    {
        "id": "scene_02_origem",
        "text": "Apesar desse jeitinho dengoso e brincalhão, esses pequenos têm sangue nobre! Na China antiga, eles eram considerados sagrados e viviam cheios de mimos no colo dos imperadores da dinastia Ming."
    },
    {
        "id": "scene_03_caracteristicas",
        "text": "Com olhinhos grandes e brilhantes, um focinho achatado irresistível e uma pelagem macia como algodão doce, cada filhote parece um bichinho de pelúcia que ganhou vida para nos encantar."
    },
    {
        "id": "scene_04_rotina",
        "text": "A rotina de um filhote é uma verdadeira maratona: eles correm em círculos por dez minutos, pulam desengonçados atrás de uma meia e, do nada... caem no sono mais pesado do mundo, roncando bem baixinho."
    },
    {
        "id": "scene_05_cuidados",
        "text": "Para vê-los crescer saudáveis e felizes, os cuidados são simples: escovação regular dos pelos, proteção nos dias quentes, alimentação de qualidade e, o mais importante de tudo, muito carinho e paciência."
    },
    {
        "id": "scene_06_amor",
        "text": "Quem tem um Shih Tzu em casa descobre que a lealdade tem quatro patas e um rabinho que não para de abanar. Eles não são apenas bichinhos de estimação; são pequenos pacotes de pura ternura."
    },
    {
        "id": "scene_07_desfecho",
        "text": "Dizem que a felicidade não se compra pronta, mas ela certamente pode vir embrulhada em pelos macios e um olhar apaixonado. Cuide com amor do seu eterno bebezinho!"
    }
]

results = []

for sc in scenes:
    print(f"Synthesizing {sc['id']}...", flush=True)
    cmd = [
        sys.executable,
        script_path,
        "--text", sc["text"],
        "--voice", "pt-BR-AntonioNeural",
        "--project-dir", project_dir,
        "--filename", sc["id"],
        "--fps", "30",
        "--padding-frames", "20",
        "--rate=-5%"
    ]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print(f"Error in {sc['id']}: {proc.stderr}", file=sys.stderr)
        sys.exit(1)
    
    try:
        data = json.loads(proc.stdout)
        results.append(data)
        print(f"Done {sc['id']}: {data['durationSeconds']}s ({data['totalDurationInFrames']} frames)", flush=True)
    except Exception as e:
        print(f"Parse error in {sc['id']}: {e}\nOutput: {proc.stdout}", file=sys.stderr)
        sys.exit(1)

with open(os.path.join(project_dir, "voiceovers_manifest.json"), "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("All voiceovers synthesized successfully!")
