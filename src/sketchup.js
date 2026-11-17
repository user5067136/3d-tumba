/**
 * Генератор Ruby-скрипта для SketchUp.
 * Скрипт строит ту же модель, что и 3D-просмотрщик, в группе «Тумба 600 × 450 × 510».
 */
import { PARTS, HANDLE, MATERIAL_DEFS, DIMENSIONS } from './nightstand.js';

const ruby = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));

function colorTuple(hex) {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return `${r}, ${g}, ${b}`;
}

function sameColorKeys() {
  const keys = new Set(PARTS.map((p) => p.mat));
  keys.add('brass');
  return [...keys].filter((key) => MATERIAL_DEFS[key]);
}

export function buildSketchupScript() {
  const { width, depth, height } = DIMENSIONS;
  const mats = sameColorKeys();

  const materialLines = mats
    .map((key) => {
      const def = MATERIAL_DEFS[key];
      return `      m['${key}'] = Tumba3D.material(model, '${def.label}', ${colorTuple(def.exportColor)})`;
    })
    .join('\n');

  const caseParts = PARTS.filter((p) => p.group === 'case');
  const drawerParts = PARTS.filter((p) => p.group === 'drawer');

  const boxLine = (part, target) => {
    const [x, y, z] = part.min;
    const [w, h, d] = part.size;
    return `Tumba3D.add_box(${target}, '${part.name}', [${ruby(x)}, ${ruby(z)}, ${ruby(y)}], [${ruby(w)}, ${ruby(d)}, ${ruby(h)}], m['${part.mat}'])`;
  };

  const caseCode = caseParts.map((p) => `  ${boxLine(p, 'korpus')};`).join('\n');
  const drawerCode = drawerParts.map((p) => `  ${boxLine(p, 'yashchik')};`).join('\n');

  return `# encoding: UTF-8
# ============================================================================
#  Прикроватная тумба ${width} × ${depth} × ${height} мм — генератор модели SketchUp
#
#  Как пользоваться:
#    1. SketchUp → Window → Ruby Console
#    2. load 'C:/путь/к/tumba-${width}x${depth}x${height}.rb'
#       (в Windows используйте прямые слэши или двойные обратные)
#    3. File → Save As… → сохраните модель как *.skp
#
#  Модель строится в группе «Тумба ${width} × ${depth} × ${height}»,
#  вложенные группы: «Корпус», «Ящик», «Ручка». Единицы — миллиметры.
# ============================================================================

module Tumba3D
  WIDTH  = ${ruby(width)}
  DEPTH  = ${ruby(depth)}
  HEIGHT = ${ruby(height)}

  # Создаёт (или переиспользует) материал нужного цвета
  def self.material(model, name, r, g, b)
    mat = model.materials[name] || model.materials.add(name)
    mat.color = Sketchup::Color.new(r, g, b)
    mat
  rescue StandardError
    model.materials.add(name)
  end

  # Прямоугольный брусок по минимальному углу и габаритам (в мм)
  def self.add_box(parent, name, min, size, material)
    x, y, z = min
    dx, dy, dz = size

    group = parent.entities.add_group
    group.name = name

    corners = [
      [x, y], [x + dx, y], [x + dx, y + dy], [x, y + dy]
    ].map { |cx, cy| Geom::Point3d.new(cx.mm, cy.mm, z.mm) }

    face = group.entities.add_face(corners)
    face.reverse! if face.normal.z < 0
    face.pushpull(dz.mm)

    group.material = material
    group
  rescue StandardError => e
    puts "  ! #{name}: #{e.message}"
    nil
  end

  # Цилиндр: center — начало оси, axis — :x / :y / :z, length и radius — в мм
  def self.add_cylinder(parent, name, center, axis, length, radius, material)
    group = parent.entities.add_group
    group.name = name

    normal = case axis
             when :x then Geom::Vector3d.new(1, 0, 0)
             when :y then Geom::Vector3d.new(0, 1, 0)
             else Geom::Vector3d.new(0, 0, 1)
             end

    start = Geom::Point3d.new(center[0].mm, center[1].mm, center[2].mm)
    edges = group.entities.add_circle(start, normal, radius.mm, 28)
    face = group.entities.add_face(edges)
    face.reverse! if face.normal.dot(normal) < 0
    face.pushpull(length.mm)

    group.material = material
    group
  rescue StandardError => e
    puts "  ! #{name}: #{e.message}"
    nil
  end

  def self.build
    model = Sketchup.active_model
    model.start_operation('Тумба ${width} × ${depth} × ${height}', true)

    begin
      m = {}
${materialLines}

      tag = model.layers['Тумба'] || model.layers.add('Тумба')

      root = model.entities.add_group
      root.name = 'Тумба ${width} × ${depth} × ${height}'
      root.layer = tag

      korpus = root.entities.add_group
      korpus.name = 'Корпус'
      korpus.layer = tag

${caseCode}

      yashchik = root.entities.add_group
      yashchik.name = 'Ящик'
      yashchik.layer = tag

${drawerCode}

      ruchka = yashchik.entities.add_group
      ruchka.name = 'Ручка'
      ruchka.layer = tag

      # перекладина ручки — вдоль оси X
      Tumba3D.add_cylinder(ruchka, 'Перекладина', [${ruby(-HANDLE.barLength / 2)}, ${ruby(HANDLE.barZ)}, ${ruby(HANDLE.y)}], :x, ${ruby(HANDLE.barLength)}, ${ruby(HANDLE.barRadius)}, m['brass'])
      # стойки — вдоль оси Y (глубина)
      [${ruby(-HANDLE.stemX)}, ${ruby(HANDLE.stemX)}].each do |x|
        Tumba3D.add_cylinder(ruchka, 'Стойка', [x, ${ruby(HANDLE.frontZ)}, ${ruby(HANDLE.y)}], :y, ${ruby(HANDLE.barZ - HANDLE.frontZ)}, ${ruby(HANDLE.stemRadius)}, m['brass'])
      end

      model.commit_operation
      model.active_view.zoom_extents

      puts ''
      puts 'Готово: тумба ${width} × ${depth} × ${height} мм построена (${PARTS.length + 3} элементов).'
      puts 'Сохраните модель: File → Save As… → *.skp'
      puts ''
    rescue StandardError => e
      model.abort_operation
      puts "Ошибка построения: #{e.message}"
      puts e.backtrace.first(5)
    end
  end
end

Tumba3D.build
`;
}
