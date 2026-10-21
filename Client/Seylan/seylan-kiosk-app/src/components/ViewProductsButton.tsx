import { StyleSheet, View } from 'react-native';

import { config } from '../config';
import { ArrowRightIcon, BankIcon } from './icons';
import { SeylanButton } from './SeylanButton';

type Props = {
  onPress: () => void;
};

/**
 * "View products" over the Sensor. Nothing opens Seylan's site on its own; the
 * customer chooses here (or with the Sensor's own link).
 */
export function ViewProductsButton({ onPress }: Props) {
  return (
    <View style={[styles.anchor, config.viewProductsOffset]} pointerEvents="box-none">
      <SeylanButton
        label="View products"
        accessibilityLabel="View Seylan Bank products"
        icon={<BankIcon size={20} />}
        trailing={<ArrowRightIcon size={18} />}
        onPress={onPress}
        pulse
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
  },
});
